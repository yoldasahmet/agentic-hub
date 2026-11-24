import { type WorkspaceRole, workspaceRoleSchema } from "@agentic/contracts";
import { type Database, schema } from "@agentic/db";
import { and, eq, gt, lte } from "drizzle-orm";
import type { UserRow } from "./repository";

const { authSessions: sessions, users, workspaces, workspaceMembers: members } = schema;

export type NewSession = {
  userId: string;
  workspaceId: string;
  tokenHash: string;
  client: string;
  expiresAt: Date;
};

/** A live session joined with its user and membership, in one round trip. */
export type SessionPrincipal = {
  sessionId: string;
  expiresAt: Date;
  user: UserRow;
  workspace: { id: string; name: string };
  role: WorkspaceRole;
};

/** Sessions by token hash; the raw token never reaches the database. */
export class SessionRepository {
  constructor(private readonly db: Database) {}

  /** Also drops the user's expired sessions, so the table doesn't grow without bound. */
  async create(row: NewSession): Promise<void> {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, row.userId), lte(sessions.expiresAt, new Date())));
    await this.db.insert(sessions).values(row);
  }

  /** Unexpired, and only while the user is still a member of the session's workspace. */
  async principal(tokenHash: string): Promise<SessionPrincipal | undefined> {
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        id: users.id,
        kind: users.kind,
        displayName: users.displayName,
        email: users.email,
        passwordHash: users.passwordHash,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        role: members.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(workspaces, eq(workspaces.id, sessions.workspaceId))
      .innerJoin(
        members,
        and(eq(members.workspaceId, sessions.workspaceId), eq(members.userId, sessions.userId)),
      )
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row) return undefined;
    const { sessionId, expiresAt, workspaceId, workspaceName, role, ...user } = row;
    return {
      sessionId,
      expiresAt,
      user,
      workspace: { id: workspaceId, name: workspaceName },
      role: workspaceRoleSchema.catch("member").parse(role),
    };
  }

  async renew(id: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ expiresAt, lastSeenAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
