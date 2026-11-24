import { AppError } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, asc, eq, inArray } from "drizzle-orm";

const { mcpServers } = schema;
export type McpServerRow = typeof mcpServers.$inferSelect;
type Values = { name: string; enabled: boolean; transport: string; config: unknown };

/** MCP servers per workspace. Secret values never land here; the config holds vault names. */
export class McpServerRepository {
  constructor(private readonly db: Database) {}

  list(workspaceId: string): Promise<McpServerRow[]> {
    return this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.workspaceId, workspaceId))
      .orderBy(asc(mcpServers.name));
  }

  byNames(workspaceId: string, names: readonly string[]): Promise<McpServerRow[]> {
    if (names.length === 0) return Promise.resolve([]);
    return this.db
      .select()
      .from(mcpServers)
      .where(
        and(
          eq(mcpServers.workspaceId, workspaceId),
          eq(mcpServers.enabled, true),
          inArray(mcpServers.name, [...names]),
        ),
      );
  }

  async get(ctx: LocalContext, id: string): Promise<McpServerRow> {
    const [row] = await this.db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.workspaceId, ctx.workspaceId), eq(mcpServers.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `MCP server ${id} not found`);
    return row;
  }

  async insert(ctx: LocalContext, values: Values): Promise<McpServerRow> {
    const [row] = await this.db
      .insert(mcpServers)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, ...values })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new AppError("conflict", `An MCP server named ${values.name} already exists`);
    return row;
  }

  async update(ctx: LocalContext, id: string, values: Values): Promise<McpServerRow> {
    const [row] = await this.db
      .update(mcpServers)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(mcpServers.workspaceId, ctx.workspaceId), eq(mcpServers.id, id)))
      .returning();
    if (!row) throw new AppError("not_found", `MCP server ${id} not found`);
    return row;
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.db
      .delete(mcpServers)
      .where(and(eq(mcpServers.workspaceId, ctx.workspaceId), eq(mcpServers.id, id)));
  }
}
