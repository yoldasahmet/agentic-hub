import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const { settings } = schema;
const KEY = "auth:settings";

const authSettingsSchema = z.object({ autoSignIn: z.boolean().default(true) });
export type AuthSettings = z.infer<typeof authSettingsSchema>;

/** The workspace's sign-in preferences, one settings row. Auto sign-in is on by default. */
export class AuthSettingsRepository {
  constructor(private readonly db: Database) {}

  async get(workspaceId: string): Promise<AuthSettings> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, KEY)))
      .limit(1);
    return authSettingsSchema.catch({ autoSignIn: true }).parse(row?.value ?? {});
  }

  async set(ctx: LocalContext, value: AuthSettings): Promise<void> {
    await this.db
      .insert(settings)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, key: KEY, value })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }
}
