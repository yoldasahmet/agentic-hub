import {
  authSettingsInputSchema,
  memberRoleInputSchema,
  signInInputSchema,
  signUpInputSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { MemberService } from "./member-service";
import { signedIn } from "./middleware";
import type { AuthSessionService } from "./session-service";

const userParam = z.object({ userId: z.uuidv7() });

/**
 * `/auth` sign-up and sign-in. Mounted before the session is read, so a
 * stale session header can't stand in the way of getting a new one.
 */
export const publicAuthRoutes = (auth: AuthSessionService) =>
  new Hono<AppEnv>()
    .post("/sign-up", validate("json", signUpInputSchema), async (c) =>
      c.json(await auth.signUp(c.req.valid("json")), 201),
    )
    .post("/sign-in", validate("json", signInInputSchema), async (c) =>
      c.json(await auth.signIn(c.req.valid("json"))),
    );

/** The rest of `/auth`: status works signed out; members and settings need a sign-in. */
export const authRoutes = (auth: AuthSessionService, members: MemberService) =>
  new Hono<AppEnv>()
    .get("/status", async (c) => c.json(await auth.status(c.var.principal)))
    .post("/sign-out", async (c) => {
      await auth.signOut(c.var.principal);
      return c.json({ ok: true });
    })
    .get("/members", async (c) => c.json(await members.list(signedIn(c))))
    .put(
      "/members/:userId",
      validate("param", userParam),
      validate("json", memberRoleInputSchema),
      async (c) => {
        const { userId } = c.req.valid("param");
        await members.setRole(signedIn(c), userId, c.req.valid("json").role);
        return c.json({ ok: true });
      },
    )
    .delete("/members/:userId", validate("param", userParam), async (c) => {
      await members.remove(signedIn(c), c.req.valid("param").userId);
      return c.json({ ok: true });
    })
    .put("/settings", validate("json", authSettingsInputSchema), async (c) => {
      await members.setSettings(signedIn(c), c.req.valid("json"));
      return c.json({ ok: true });
    });
