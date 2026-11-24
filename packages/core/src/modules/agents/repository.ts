import { type AgentSpec, AppError, agentSpecSchema } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, desc, eq, isNotNull, isNull, like, sql } from "drizzle-orm";

const { agents, agentVersions } = schema;

export type AgentRow = typeof agents.$inferSelect;
export type AgentVersionRow = typeof agentVersions.$inferSelect;
export type NewAgent = Pick<AgentRow, "name" | "slug" | "description" | "color" | "icon"> & {
  draft: AgentSpec;
};
export type AgentPatch = Partial<Omit<NewAgent, "draft">> & { draft?: AgentSpec };

/** Agents and their immutable versions. Every query is scoped by workspace. */
export class AgentRepository {
  constructor(private readonly db: Database) {}

  list(ctx: LocalContext, archived: boolean): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.workspaceId, ctx.workspaceId),
          archived ? isNotNull(agents.archivedAt) : isNull(agents.archivedAt),
        ),
      )
      .orderBy(desc(agents.updatedAt));
  }

  async get(ctx: LocalContext, id: string): Promise<AgentRow> {
    const [row] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Agent ${id} not found`);
    return row;
  }

  /** Every published, active agent in a workspace (chat targets, the App's catalog). */
  listPublished(workspaceId: string): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.workspaceId, workspaceId),
          isNull(agents.archivedAt),
          isNotNull(agents.latestVersion),
        ),
      )
      .orderBy(desc(agents.updatedAt));
  }

  /** Unscoped: the assistant source resolves an id a scoped call already authorized. */
  async getById(id: string): Promise<AgentRow | undefined> {
    const [row] = await this.db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return row;
  }

  /** Slugs that start with `base`, archived ones included (the unique index covers them). */
  async slugsLike(ctx: LocalContext, base: string): Promise<string[]> {
    const rows = await this.db
      .select({ slug: agents.slug })
      .from(agents)
      .where(and(eq(agents.workspaceId, ctx.workspaceId), like(agents.slug, `${base}%`)));
    return rows.map((r) => r.slug);
  }

  async insert(ctx: LocalContext, values: NewAgent): Promise<AgentRow> {
    const [row] = await this.db
      .insert(agents)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, ...values })
      .returning();
    if (!row) throw new Error("Failed to create the agent");
    return row;
  }

  /** A library entry owns one slug. Restore the existing row without replacing its draft. */
  async installBuiltin(ctx: LocalContext, values: NewAgent): Promise<AgentRow> {
    const [row] = await this.db
      .insert(agents)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, ...values })
      .onConflictDoUpdate({
        target: [agents.workspaceId, agents.slug],
        set: {
          archivedAt: null,
          updatedAt: sql`case
            when ${agents.archivedAt} is not null then now()
            else ${agents.updatedAt}
          end`,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to install the built-in agent");
    return row;
  }

  /** Applies the patch only at `revision`; a concurrent save makes this a conflict. */
  async update(
    ctx: LocalContext,
    id: string,
    revision: number,
    patch: AgentPatch,
  ): Promise<AgentRow> {
    const [row] = await this.db
      .update(agents)
      .set({ ...patch, revision: sql`${agents.revision} + 1` })
      .where(
        and(
          eq(agents.workspaceId, ctx.workspaceId),
          eq(agents.id, id),
          eq(agents.revision, revision),
        ),
      )
      .returning();
    if (row) return row;
    const current = await this.get(ctx, id);
    throw new AppError("conflict", "The agent changed since it was loaded", {
      revision: current.revision,
    });
  }

  async setArchived(ctx: LocalContext, id: string, archived: boolean): Promise<AgentRow> {
    const [row] = await this.db
      .update(agents)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.id, id)))
      .returning();
    if (!row) throw new AppError("not_found", `Agent ${id} not found`);
    return row;
  }

  /**
   * Publishes the draft as the next version. The row lock serializes
   * concurrent publishes, so version numbers never collide.
   */
  publish(ctx: LocalContext, id: string, revision: number): Promise<AgentVersionRow> {
    return this.db.transaction(async (tx) => {
      const [agent] = await tx
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.id, id)))
        .for("update");
      if (!agent) throw new AppError("not_found", `Agent ${id} not found`);
      if (agent.revision !== revision) {
        throw new AppError("conflict", "Save the latest draft before publishing", {
          revision: agent.revision,
        });
      }
      const version = (agent.latestVersion ?? 0) + 1;
      const spec = agentSpecSchema.parse(agent.draft);
      const [row] = await tx
        .insert(agentVersions)
        .values({
          workspaceId: ctx.workspaceId,
          createdBy: ctx.userId,
          agentId: id,
          version,
          kind: spec.kind,
          inputSchema: spec.inputSchema,
          outputSchema: spec.outputSchema,
          outputFormat: spec.outputFormat,
          prompt: spec.prompt,
          runtime: spec.runtime,
          capabilities: spec.capabilities,
        })
        .returning();
      await tx.update(agents).set({ latestVersion: version }).where(eq(agents.id, id));
      if (!row) throw new Error("Failed to publish the agent");
      return row;
    });
  }

  listVersions(ctx: LocalContext, agentId: string): Promise<AgentVersionRow[]> {
    return this.db
      .select()
      .from(agentVersions)
      .where(
        and(eq(agentVersions.workspaceId, ctx.workspaceId), eq(agentVersions.agentId, agentId)),
      )
      .orderBy(desc(agentVersions.version));
  }

  /** Unscoped, like `getById`. */
  async getVersion(agentId: string, version: number): Promise<AgentVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, version)))
      .limit(1);
    return row;
  }
}
