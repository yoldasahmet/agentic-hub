import { type JiraSettings, jiraSettingsSchema } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";

const { settings } = schema;
const KEY = "jira:settings";

/** The workspace's Jira site and account email (the token lives in the vault), one settings row. */
export class JiraSettingsRepository {
  constructor(private readonly db: Database) {}

  async get(workspaceId: string): Promise<JiraSettings> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, KEY)))
      .limit(1);
    return jiraSettingsSchema.catch(jiraSettingsSchema.parse({})).parse(row?.value ?? {});
  }

  async set(ctx: LocalContext, value: JiraSettings): Promise<JiraSettings> {
    await this.db
      .insert(settings)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, key: KEY, value })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
    return value;
  }
}
