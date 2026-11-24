import type { LocalContext } from "@agentic/db";
import type { Principal } from "../modules/auth/principal";

/**
 * Per-request values. `principal` is who signed in (or the local DB's auto
 * sign-in), unset when nobody is; `ctx` is set on every route behind
 * `requireSignedIn`, so module routes never see an anonymous request.
 */
export type AppEnv = { Variables: { ctx: LocalContext; principal: Principal | undefined } };
