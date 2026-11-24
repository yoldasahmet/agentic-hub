import { AppError, SESSION_HEADER } from "@agentic/contracts";
import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../../http/env";
import type { Principal } from "./principal";
import type { AuthSessionService } from "./session-service";

/** Reads the session header. A stale token is an error, so clients drop it and re-sign in. */
export function resolvePrincipal(auth: AuthSessionService): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set("principal", await auth.resolve(c.req.header(SESSION_HEADER) || undefined));
    await next();
  };
}

/** Every module route needs a principal; its workspace and user become `ctx`. */
export const requireSignedIn: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("ctx", signedIn(c).ctx);
  await next();
};

export function signedIn(c: Context<AppEnv>): Principal {
  const principal = c.var.principal;
  if (!principal) throw new AppError("auth.required", "Sign in to continue");
  return principal;
}
