import { type ToolGuardrails, toolGuardrailsSchema } from "@agentic/contracts";
import { type Database, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";

const { settings } = schema;
const KEY = "tools:guardrails";

/** The workspace's tool guardrails, one row in the settings table. */
export class GuardrailsRepository {
  constructor(private readonly db: Database) {}

  async get(workspaceId: string): Promise<ToolGuardrails> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, KEY)))
      .limit(1);
    return toolGuardrailsSchema.catch(toolGuardrailsSchema.parse({})).parse(row?.value ?? {});
  }

  async set(ctx: { workspaceId: string; userId: string }, value: ToolGuardrails): Promise<void> {
    await this.db
      .insert(settings)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, key: KEY, value })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }
}
