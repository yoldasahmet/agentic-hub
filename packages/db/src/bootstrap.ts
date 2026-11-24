import { eq, sql } from "drizzle-orm";
import type { Database } from "./connection";
import { users, workspaceMembers, workspaces } from "./schema/index";

/** Arbitrary key ("boot"): serializes first-run bootstrap across app instances. */
const BOOTSTRAP_LOCK_KEY = 0x626f6f74;
export const DEFAULT_WORKSPACE_SLUG = "default";

export type LocalContext = { workspaceId: string; userId: string };

/**
 * Creates the default workspace and the single local user on first run.
 * Idempotent and safe when several app instances share one database.
 * The first sign-up claims the local user (P17), so it stays the owner.
 */
export function bootstrapLocalWorkspace(db: Database): Promise<LocalContext> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);
    const [existing] = await tx
      .select({ workspaceId: workspaces.id, userId: workspaces.createdBy })
      .from(workspaces)
      .where(eq(workspaces.slug, DEFAULT_WORKSPACE_SLUG))
      .limit(1);
    if (existing) return existing;

    const [user] = await tx
      .insert(users)
      .values({ kind: "local", displayName: "Local user" })
      .returning({ id: users.id });
    if (!user) throw new Error("Failed to create the local user");
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: "Personal", slug: DEFAULT_WORKSPACE_SLUG, createdBy: user.id })
      .returning({ id: workspaces.id });
    if (!workspace) throw new Error("Failed to create the default workspace");
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    return { workspaceId: workspace.id, userId: user.id };
  });
}
