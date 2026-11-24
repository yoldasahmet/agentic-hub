import {
  AppError,
  type AuthUser,
  type WorkspaceMember,
  type WorkspaceRole,
  workspaceRoleSchema,
} from "@agentic/contracts";
import { type Database, DEFAULT_WORKSPACE_SLUG, schema } from "@agentic/db";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";

const { users, workspaces, workspaceMembers: members, authSessions: sessions } = schema;

/** Arbitrary key ("auth"): serializes sign-ups across app instances on a shared DB. */
const SIGN_UP_LOCK_KEY = 0x61757468;

export type UserRow = AuthUser & { passwordHash: string | null };
export type Membership = { workspace: { id: string; name: string }; role: WorkspaceRole };
export type NewAccount = {
  email: string;
  displayName: string;
  passwordHash: string;
  workspaceId: string;
};

const userColumns = {
  id: users.id,
  kind: users.kind,
  displayName: users.displayName,
  email: users.email,
  passwordHash: users.passwordHash,
};

export const toUser = ({ passwordHash: _, ...user }: UserRow): AuthUser => user;

/** Users and memberships. Every member query is scoped by workspace. */
export class AuthRepository {
  constructor(private readonly db: Database) {}

  async defaultWorkspace(): Promise<{ id: string; name: string }> {
    const [row] = await this.db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.slug, DEFAULT_WORKSPACE_SLUG))
      .limit(1);
    if (!row) throw new Error("The default workspace is missing (bootstrap did not run)");
    return row;
  }

  async userById(id: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select(userColumns).from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async userByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row;
  }

  async hasAccounts(): Promise<boolean> {
    const [row] = await this.db
      .select({ n: count() })
      .from(users)
      .where(eq(users.kind, "password"));
    return (row?.n ?? 0) > 0;
  }

  async membership(workspaceId: string, userId: string): Promise<Membership | undefined> {
    const [row] = await this.db
      .select({ id: workspaces.id, name: workspaces.name, role: members.role })
      .from(members)
      .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
      .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
      .limit(1);
    if (!row) return undefined;
    const role = workspaceRoleSchema.catch("member").parse(row.role);
    return { workspace: { id: row.id, name: row.name }, role };
  }

  /** The longest-standing owner: who auto sign-in acts as on the local DB. */
  async firstOwner(workspaceId: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select(userColumns)
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(and(eq(members.workspaceId, workspaceId), eq(members.role, "owner")))
      .orderBy(asc(members.createdAt), asc(users.id))
      .limit(1);
    return row;
  }

  async members(workspaceId: string): Promise<WorkspaceMember[]> {
    const rows = await this.db
      .select({ ...userColumns, role: members.role, joinedAt: members.createdAt })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(asc(members.createdAt));
    return rows.map(({ role, joinedAt, ...user }) => ({
      user: toUser(user),
      role: workspaceRoleSchema.catch("member").parse(role),
      joinedAt: joinedAt.toISOString(),
    }));
  }

  async countOwners(workspaceId: string, except?: string): Promise<number> {
    const filters = [eq(members.workspaceId, workspaceId), eq(members.role, "owner")];
    if (except) filters.push(ne(members.userId, except));
    const [row] = await this.db
      .select({ n: count() })
      .from(members)
      .where(and(...filters));
    return row?.n ?? 0;
  }

  async setRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<boolean> {
    const rows = await this.db
      .update(members)
      .set({ role })
      .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
      .returning({ userId: members.userId });
    return rows.length > 0;
  }

  /** Removes the membership and the sessions it had in this workspace. */
  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(sessions)
        .where(and(eq(sessions.workspaceId, workspaceId), eq(sessions.userId, userId)));
      const rows = await tx
        .delete(members)
        .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
        .returning({ userId: members.userId });
      return rows.length > 0;
    });
  }

  /**
   * Signs up under a lock, so two first sign-ups can't both claim the
   * bootstrap account. The first account takes over the local owner (its
   * rows keep their `created_by`); later ones join as members.
   */
  async createAccount(input: NewAccount): Promise<{ user: AuthUser; role: WorkspaceRole }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${SIGN_UP_LOCK_KEY})`);
      const [taken] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (taken) throw new AppError("conflict", "An account with this email already exists");
      const values = {
        kind: "password",
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
      };
      const [local] = await tx
        .select({ id: users.id })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(members.workspaceId, input.workspaceId),
            eq(members.role, "owner"),
            eq(users.kind, "local"),
          ),
        )
        .limit(1);
      if (local) {
        const [user] = await tx
          .update(users)
          .set(values)
          .where(eq(users.id, local.id))
          .returning(userColumns);
        if (user) return { user: toUser(user), role: "owner" };
      }
      const [user] = await tx.insert(users).values(values).returning(userColumns);
      if (!user) throw new Error("Failed to create the user");
      await tx
        .insert(members)
        .values({ workspaceId: input.workspaceId, userId: user.id, role: "member" });
      return { user: toUser(user), role: "member" };
    });
  }
}
