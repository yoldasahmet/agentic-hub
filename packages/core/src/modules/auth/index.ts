import type { DbMode } from "@agentic/contracts";
import type { Database } from "@agentic/db";
import { MemberService } from "./member-service";
import { AuthRepository } from "./repository";
import { SessionRepository } from "./session-repository";
import { AuthSessionService } from "./session-service";
import { AuthSettingsRepository } from "./settings-repository";

export type AuthModule = ReturnType<typeof createAuthModule>;

/** Accounts, sessions, and members (P17). `dbMode` decides whether auto sign-in may apply. */
export function createAuthModule(db: Database, dbMode: DbMode) {
  const repo = new AuthRepository(db);
  const settings = new AuthSettingsRepository(db);
  return {
    sessions: new AuthSessionService(repo, new SessionRepository(db), settings, dbMode),
    members: new MemberService(repo, settings, dbMode),
  };
}
