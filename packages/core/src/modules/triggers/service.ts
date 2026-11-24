import {
  AppError,
  type CreateTriggerInput,
  createTriggerInputSchema,
  type Run,
  type Trigger,
  type UpdateTriggerInput,
  updateTriggerInputSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { z } from "zod";
import type { WorkflowModule } from "../workflows/index";
import { firstFire, triggerConfigSchema } from "./config";
import { toTrigger } from "./mappers";
import type { TriggerRepository, TriggerRow } from "./repository";

const jsonInputSchema = z.record(z.string(), z.json());

/**
 * Manual, scheduled, GitHub, and Jira triggers: saved inputs that start a
 * published workflow version (GitHub items and Jira issues add theirs, see the pollers).
 */
export class TriggerService {
  constructor(
    private readonly repo: TriggerRepository,
    private readonly workflows: WorkflowModule,
  ) {}

  async list(ctx: LocalContext, workflowId: string): Promise<Trigger[]> {
    await this.workflows.service.get(ctx, workflowId);
    return (await this.repo.list(ctx, workflowId)).map(toTrigger);
  }

  async create(ctx: LocalContext, workflowId: string, raw: CreateTriggerInput): Promise<Trigger> {
    const input = createTriggerInputSchema.parse(raw);
    await this.workflows.service.get(ctx, workflowId);
    if (input.kind === "schedule" && !input.schedule) {
      throw new AppError("validation_failed", "A scheduled trigger needs a schedule");
    }
    if (input.kind === "github" && !input.github) {
      throw new AppError("validation_failed", "A GitHub trigger needs a repo and an event");
    }
    if (input.github?.event === "issue.labeled" && !input.github.label) {
      throw new AppError("validation_failed", "Choose the label to watch");
    }
    if (input.kind === "jira" && !input.jira) {
      throw new AppError("validation_failed", "A Jira trigger needs a JQL query");
    }
    const schedule = input.kind === "schedule" ? (input.schedule ?? null) : null;
    const github = input.kind === "github" ? (input.github ?? null) : null;
    const jira = input.kind === "jira" ? (input.jira ?? null) : null;
    const config = triggerConfigSchema.parse({ ...input, schedule, github, jira });
    const next = firstFire(config, input.enabled);
    const row = await this.repo.insert(ctx, { ...input, workflowId, config }, next);
    return toTrigger(row);
  }

  async update(ctx: LocalContext, id: string, raw: UpdateTriggerInput): Promise<Trigger> {
    const patch = updateTriggerInputSchema.parse(raw);
    const row = await this.repo.get(ctx, id);
    const current = triggerConfigSchema.parse(row.config);
    const github = row.kind === "github" ? (patch.github ?? current.github) : null;
    const jira = row.kind === "jira" ? (patch.jira ?? current.jira) : null;
    const config = triggerConfigSchema.parse({
      ...current,
      ...patch,
      schedule: row.kind === "schedule" ? (patch.schedule ?? current.schedule) : null,
      github,
      jira,
      // Another query starts from a fresh baseline.
      jiraState: jira?.jql === current.jira?.jql ? current.jiraState : { primed: false, seen: [] },
      // Another repo or event starts from a fresh baseline.
      githubState:
        github?.repo === current.github?.repo && github?.event === current.github?.event
          ? current.githubState
          : { since: null, seen: [] },
    });
    const enabled = patch.enabled ?? row.enabled;
    const nextFireAt = firstFire(config, enabled);
    return toTrigger(await this.repo.update(id, { enabled, config, nextFireAt }));
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.repo.get(ctx, id);
    await this.repo.remove(ctx, id);
  }

  /** "Run now", from the UI or a schedule's job. The outcome is kept on the trigger. */
  async fire(ctx: LocalContext, id: string): Promise<Run> {
    return this.start(ctx, await this.repo.get(ctx, id));
  }

  /** A run for one GitHub item or Jira issue: the saved inputs plus the item's. */
  startWith(row: TriggerRow, extra: Record<string, unknown>): Promise<Run> {
    const ctx = { workspaceId: row.workspaceId, userId: row.createdBy };
    return this.start(ctx, row, jsonInputSchema.parse(extra));
  }

  /** The `trigger.fire` job: the trigger's own workspace and creator are the context. */
  async fireFromJob(triggerId: string): Promise<void> {
    const row = await this.repo.getById(triggerId);
    if (!row?.enabled) return;
    await this.start({ workspaceId: row.workspaceId, userId: row.createdBy }, row).catch(
      () => undefined,
    );
  }

  private async start(
    ctx: LocalContext,
    row: TriggerRow,
    extra: z.infer<typeof jsonInputSchema> = {},
  ): Promise<Run> {
    const config = triggerConfigSchema.parse(row.config);
    try {
      const workflow = await this.workflows.service.get(ctx, row.targetId);
      const version = config.version === "latest" ? workflow.latestVersion : config.version;
      if (version === null) throw new AppError("conflict", `Publish ${workflow.name} first`);
      const run = await this.workflows.runner.run(ctx, row.targetId, {
        version,
        input: { ...config.input, ...extra },
      });
      await this.repo.update(row.id, {
        config: { ...config, lastRunId: run.id, lastError: null },
        lastFiredAt: new Date(),
      });
      return run;
    } catch (err) {
      const message = AppError.from(err).message;
      await this.repo.update(row.id, { config: { ...config, lastError: message } });
      throw err;
    }
  }
}
