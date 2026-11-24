import { type GithubSettings, githubSettingsSchema } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";

const { settings } = schema;
const KEY = "github:settings";

/** Non-secret GitHub settings of a workspace (the OAuth app client id), one settings row. */
export class GithubSettingsRepository {
  constructor(private readonly db: Database) {}

  async get(workspaceId: string): Promise<GithubSettings> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, KEY)))
      .limit(1);
    return githubSettingsSchema.catch(githubSettingsSchema.parse({})).parse(row?.value ?? {});
  }

  async set(ctx: LocalContext, value: GithubSettings): Promise<GithubSettings> {
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
