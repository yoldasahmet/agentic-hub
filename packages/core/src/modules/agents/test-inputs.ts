import { type AgentTestInput, agentTestInputsSchema } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";

const { settings } = schema;
const key = (agentId: string) => `agent:${agentId}:test-inputs`;

/** Playground inputs saved per agent, in the workspace settings table. */
export class TestInputRepository {
  constructor(private readonly db: Database) {}

  async get(ctx: LocalContext, agentId: string): Promise<AgentTestInput[]> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, ctx.workspaceId), eq(settings.key, key(agentId))))
      .limit(1);
    return agentTestInputsSchema.catch([]).parse(row?.value ?? []);
  }

  async set(ctx: LocalContext, agentId: string, inputs: AgentTestInput[]): Promise<void> {
    await this.db
      .insert(settings)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        key: key(agentId),
        value: inputs,
      })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }
}
