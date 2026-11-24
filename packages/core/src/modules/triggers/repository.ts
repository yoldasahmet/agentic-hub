import { AppError } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import type { JobHost } from "@agentic/graph";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nextFire, nextPoll, type TriggerConfig, triggerConfigSchema } from "./config";

const { triggers } = schema;
export type TriggerRow = typeof triggers.$inferSelect;
type NewTrigger = { kind: string; workflowId: string; enabled: boolean; config: TriggerConfig };

export const FIRE_JOB_KIND = "trigger.fire";
export const POLL_JOB_KIND = "trigger.github.poll";
export const JIRA_POLL_JOB_KIND = "trigger.jira.poll";

const JOB_KIND: Record<string, string> = { github: POLL_JOB_KIND, jira: JIRA_POLL_JOB_KIND };

/** Workflow triggers. User queries are scoped; the scheduler and job handler serve all workspaces. */
export class TriggerRepository {
  constructor(private readonly db: Database) {}

  list(ctx: LocalContext, workflowId: string): Promise<TriggerRow[]> {
    return this.db
      .select()
      .from(triggers)
      .where(
        and(
          eq(triggers.workspaceId, ctx.workspaceId),
          eq(triggers.targetKind, "workflow"),
          eq(triggers.targetId, workflowId),
        ),
      )
      .orderBy(desc(triggers.id));
  }

  async get(ctx: LocalContext, id: string): Promise<TriggerRow> {
    const [row] = await this.db
      .select()
      .from(triggers)
      .where(and(eq(triggers.workspaceId, ctx.workspaceId), eq(triggers.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Trigger ${id} not found`);
    return row;
  }

  async getById(id: string): Promise<TriggerRow | undefined> {
    const [row] = await this.db.select().from(triggers).where(eq(triggers.id, id)).limit(1);
    return row;
  }

  async insert(ctx: LocalContext, input: NewTrigger, nextFireAt: Date | null): Promise<TriggerRow> {
    const [row] = await this.db
      .insert(triggers)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        kind: input.kind,
        targetKind: "workflow",
        targetId: input.workflowId,
        enabled: input.enabled,
        config: input.config,
        nextFireAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create the trigger");
    return row;
  }

  async update(
    id: string,
    patch: {
      enabled?: boolean;
      config?: TriggerConfig;
      nextFireAt?: Date | null;
      lastFiredAt?: Date;
    },
  ): Promise<TriggerRow> {
    const [row] = await this.db.update(triggers).set(patch).where(eq(triggers.id, id)).returning();
    if (!row) throw new AppError("not_found", `Trigger ${id} not found`);
    return row;
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.db
      .delete(triggers)
      .where(and(eq(triggers.workspaceId, ctx.workspaceId), eq(triggers.id, id)));
  }

  /**
   * Claims due schedules and GitHub/Jira polls with `SKIP LOCKED`, moves each to
   * its next time, and enqueues one fire (or poll) job, all in one
   * transaction: across app instances sharing the DB, each due time runs
   * exactly once.
   */
  async claimDue(jobs: JobHost, limit = 20): Promise<number> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(triggers)
        .where(
          and(
            eq(triggers.enabled, true),
            inArray(triggers.kind, ["schedule", "github", "jira"]),
            sql`${triggers.nextFireAt} <= now()`,
          ),
        )
        .limit(limit)
        .for("update", { skipLocked: true });
      for (const row of due) {
        const config = triggerConfigSchema.parse(row.config);
        const next = config.schedule ? nextFire(config.schedule) : nextPoll(config);
        await tx
          .update(triggers)
          .set({ nextFireAt: next, lastFiredAt: new Date() })
          .where(eq(triggers.id, row.id));
        const kind = JOB_KIND[row.kind] ?? FIRE_JOB_KIND;
        const job = { workspaceId: row.workspaceId, createdBy: row.createdBy, kind };
        await jobs.enqueue({ ...job, payload: { triggerId: row.id }, maxAttempts: 1 }, tx);
      }
      return due.length;
    });
  }
}
