import {
  AppError,
  type CreateWorkflowInput,
  colorForId,
  createWorkflowInputSchema,
  defaultWorkflowDocument,
  hasBlockingIssues,
  newId,
  type SavedWorkflow,
  type UpdateWorkflowInput,
  updateWorkflowInputSchema,
  type ValidationIssue,
  type Workflow,
  type WorkflowDocument,
  type WorkflowListQuery,
  type WorkflowVersion,
  workflowDocumentSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { pinDocument, validateWorkflow } from "@agentic/workflows";
import { slugify, uniqueSlug } from "../../lib/slug";
import { toWorkflow, toWorkflowVersion } from "./mappers";
import type { WorkflowReferences } from "./references";
import type { WorkflowRepository } from "./repository";

/** Workflow CRUD, drafts with live validation, and publishing (D10). */
export class WorkflowService {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly refs: WorkflowReferences,
  ) {}

  async list(ctx: LocalContext, query: WorkflowListQuery): Promise<Workflow[]> {
    return (await this.repo.list(ctx, query.archived === "1")).map(toWorkflow);
  }

  async get(ctx: LocalContext, id: string): Promise<Workflow> {
    return toWorkflow(await this.repo.get(ctx, id));
  }

  async create(ctx: LocalContext, raw: CreateWorkflowInput): Promise<Workflow> {
    const input = createWorkflowInputSchema.parse(raw);
    const base = input.slug ?? slugify(input.name, "workflow");
    const slug = uniqueSlug(base, await this.repo.slugsLike(ctx, base));
    const row = await this.repo.insert(ctx, {
      name: input.name,
      slug,
      description: input.description,
      color: input.color ?? colorForId(newId()),
      icon: input.icon ?? "workflow",
      draft: input.document ?? defaultWorkflowDocument(),
    });
    return toWorkflow(row);
  }

  /** Autosave at the caller's revision. The answer carries the draft's validation issues. */
  async update(ctx: LocalContext, id: string, raw: UpdateWorkflowInput): Promise<SavedWorkflow> {
    const { revision, ...patch } = updateWorkflowInputSchema.parse(raw);
    if (patch.slug) {
      const current = await this.repo.get(ctx, id);
      const taken = await this.repo.slugsLike(ctx, patch.slug);
      if (patch.slug !== current.slug && taken.includes(patch.slug)) {
        throw new AppError("conflict", `Another workflow already uses the slug ${patch.slug}`);
      }
    }
    const workflow = toWorkflow(await this.repo.update(ctx, id, revision, patch));
    return { ...workflow, issues: await this.issues(ctx, workflow.id, workflow.draft) };
  }

  async validate(ctx: LocalContext, id: string): Promise<ValidationIssue[]> {
    const workflow = await this.get(ctx, id);
    return this.issues(ctx, id, workflow.draft);
  }

  async setArchived(ctx: LocalContext, id: string, archived: boolean): Promise<Workflow> {
    return toWorkflow(await this.repo.setArchived(ctx, id, archived));
  }

  /** Publishing refuses errors and pins every `latest` reference to a number. */
  async publish(ctx: LocalContext, id: string, revision: number): Promise<WorkflowVersion> {
    const workflow = await this.get(ctx, id);
    const document = await this.runnable(ctx, id, workflow.draft);
    return toWorkflowVersion(await this.repo.publish(ctx, id, revision, document));
  }

  async versions(ctx: LocalContext, id: string): Promise<WorkflowVersion[]> {
    await this.repo.get(ctx, id);
    return (await this.repo.listVersions(ctx, id)).map(toWorkflowVersion);
  }

  /** Callers have loaded the workflow in `ctx`, which scopes the unscoped version read. */
  async version(id: string, version: number): Promise<WorkflowVersion> {
    const row = await this.repo.getVersion(id, version);
    if (!row) throw new AppError("not_found", `This workflow has no version ${version}`);
    return toWorkflowVersion(row);
  }

  /** Callers have loaded the workflow in `ctx`, like `version`. */
  async snapshotDocument(id: string, revision: number): Promise<WorkflowDocument> {
    const raw = await this.repo.getSnapshot(id, revision);
    if (raw === undefined)
      throw new AppError("not_found", `This workflow has no snapshot r${revision}`);
    return workflowDocumentSchema.parse(raw);
  }

  /** A draft run pins the draft at its revision; reruns at the same revision reuse it. */
  async snapshot(ctx: LocalContext, workflow: Workflow): Promise<void> {
    const document = await this.runnable(ctx, workflow.id, workflow.draft);
    await this.repo.saveSnapshot(ctx, workflow.id, workflow.revision, document);
  }

  /** Validates (errors block) and pins a document so it can run. */
  private async runnable(
    ctx: LocalContext,
    id: string,
    draft: WorkflowDocument,
  ): Promise<WorkflowDocument> {
    const issues = await this.issues(ctx, id, draft);
    if (hasBlockingIssues(issues)) {
      throw new AppError("workflow.invalid", "Fix the workflow's errors first", { issues });
    }
    return pinDocument(draft, this.refs.latest(ctx.workspaceId));
  }

  private async issues(ctx: LocalContext, id: string, doc: WorkflowDocument) {
    return validateWorkflow(doc, await this.refs.catalog(ctx, doc), id);
  }
}
