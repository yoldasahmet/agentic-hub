import { AppError, type WorkflowDocument } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, desc, eq, isNotNull, isNull, like, sql } from "drizzle-orm";

const { workflows, workflowVersions, workflowSnapshots } = schema;

export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowVersionRow = typeof workflowVersions.$inferSelect;
export type NewWorkflow = Pick<WorkflowRow, "name" | "slug" | "description" | "color" | "icon"> & {
  draft: WorkflowDocument;
};
export type WorkflowPatch = Partial<NewWorkflow>;

/** Workflows, their immutable versions, and draft snapshots. Every user query is scoped. */
export class WorkflowRepository {
  constructor(private readonly db: Database) {}

  list(ctx: LocalContext, archived: boolean): Promise<WorkflowRow[]> {
    return this.db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.workspaceId, ctx.workspaceId),
          archived ? isNotNull(workflows.archivedAt) : isNull(workflows.archivedAt),
        ),
      )
      .orderBy(desc(workflows.updatedAt));
  }

  async get(ctx: LocalContext, id: string): Promise<WorkflowRow> {
    const [row] = await this.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.workspaceId, ctx.workspaceId), eq(workflows.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Workflow ${id} not found`);
    return row;
  }

  /** Every published, active workflow in a workspace (chat targets, the App's catalog). */
  listPublished(workspaceId: string): Promise<WorkflowRow[]> {
    return this.db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.workspaceId, workspaceId),
          isNull(workflows.archivedAt),
          isNotNull(workflows.latestVersion),
        ),
      )
      .orderBy(desc(workflows.updatedAt));
  }

  /** Unscoped: the assistant source and the job worker resolve ids already authorized. */
  async getById(id: string): Promise<WorkflowRow | undefined> {
    const [row] = await this.db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    return row;
  }

  async slugsLike(ctx: LocalContext, base: string): Promise<string[]> {
    const rows = await this.db
      .select({ slug: workflows.slug })
      .from(workflows)
      .where(and(eq(workflows.workspaceId, ctx.workspaceId), like(workflows.slug, `${base}%`)));
    return rows.map((r) => r.slug);
  }

  async insert(ctx: LocalContext, values: NewWorkflow): Promise<WorkflowRow> {
    const [row] = await this.db
      .insert(workflows)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, ...values })
      .returning();
    if (!row) throw new Error("Failed to create the workflow");
    return row;
  }

  /** Applies the patch only at `revision`; a concurrent save makes this a conflict. */
  async update(
    ctx: LocalContext,
    id: string,
    revision: number,
    patch: WorkflowPatch,
  ): Promise<WorkflowRow> {
    const [row] = await this.db
      .update(workflows)
      .set({ ...patch, revision: sql`${workflows.revision} + 1` })
      .where(
        and(
          eq(workflows.workspaceId, ctx.workspaceId),
          eq(workflows.id, id),
          eq(workflows.revision, revision),
        ),
      )
      .returning();
    if (row) return row;
    const current = await this.get(ctx, id);
    throw new AppError("conflict", "The workflow changed since it was loaded", {
      revision: current.revision,
    });
  }

  async setArchived(ctx: LocalContext, id: string, archived: boolean): Promise<WorkflowRow> {
    const [row] = await this.db
      .update(workflows)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(workflows.workspaceId, ctx.workspaceId), eq(workflows.id, id)))
      .returning();
    if (!row) throw new AppError("not_found", `Workflow ${id} not found`);
    return row;
  }

  /**
   * Stores `document` (the pinned draft) as the next version. The row lock
   * serializes publishes, and `revision` proves the draft wasn't edited
   * after it was pinned and validated.
   */
  publish(
    ctx: LocalContext,
    id: string,
    revision: number,
    document: WorkflowDocument,
  ): Promise<WorkflowVersionRow> {
    return this.db.transaction(async (tx) => {
      const [workflow] = await tx
        .select()
        .from(workflows)
        .where(and(eq(workflows.workspaceId, ctx.workspaceId), eq(workflows.id, id)))
        .for("update");
      if (!workflow) throw new AppError("not_found", `Workflow ${id} not found`);
      if (workflow.revision !== revision) {
        throw new AppError("conflict", "Save the latest draft before publishing", {
          revision: workflow.revision,
        });
      }
      const version = (workflow.latestVersion ?? 0) + 1;
      const [row] = await tx
        .insert(workflowVersions)
        .values({
          workspaceId: ctx.workspaceId,
          createdBy: ctx.userId,
          workflowId: id,
          version,
          document,
        })
        .returning();
      await tx.update(workflows).set({ latestVersion: version }).where(eq(workflows.id, id));
      if (!row) throw new Error("Failed to publish the workflow");
      return row;
    });
  }

  listVersions(ctx: LocalContext, workflowId: string): Promise<WorkflowVersionRow[]> {
    return this.db
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.workspaceId, ctx.workspaceId),
          eq(workflowVersions.workflowId, workflowId),
        ),
      )
      .orderBy(desc(workflowVersions.version));
  }

  /** Unscoped, like `getById`. */
  async getVersion(workflowId: string, version: number): Promise<WorkflowVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workflowVersions)
      .where(
        and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.version, version)),
      )
      .limit(1);
    return row;
  }

  /** One snapshot per revision; a second draft run at the same revision reuses it. */
  async saveSnapshot(
    ctx: LocalContext,
    workflowId: string,
    revision: number,
    document: WorkflowDocument,
  ): Promise<void> {
    await this.db
      .insert(workflowSnapshots)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        workflowId,
        revision,
        document,
      })
      .onConflictDoNothing();
  }

  /** Unscoped, like `getById`. */
  async getSnapshot(workflowId: string, revision: number): Promise<unknown> {
    const [row] = await this.db
      .select({ document: workflowSnapshots.document })
      .from(workflowSnapshots)
      .where(
        and(eq(workflowSnapshots.workflowId, workflowId), eq(workflowSnapshots.revision, revision)),
      )
      .limit(1);
    return row?.document;
  }
}
