import { AppError, type AuthUser, type WorkspaceRole } from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";

/**
 * Who a request acts as. `via: "auto"` is the local DB's auto sign-in
 * (no session); `tokenHash` is set for a session so sign-out can end it.
 */
export type Principal = {
  ctx: LocalContext;
  user: AuthUser;
  workspace: { id: string; name: string };
  role: WorkspaceRole;
  via: "session" | "auto";
  tokenHash?: string;
};

export function requireOwner(principal: Principal): void {
  if (principal.role !== "owner") {
    throw new AppError("forbidden", "Only a workspace owner can do this");
  }
}
