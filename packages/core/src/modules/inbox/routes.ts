import type { GraphRuntime } from "@agentic/graph";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";

/** Pending human gates across the workspace: what the Inbox shows. */
export const inboxRoutes = ({ runs }: GraphRuntime) =>
  new Hono<AppEnv>().get("/interrupts", async (c) =>
    c.json(await runs.pendingInterrupts(c.var.ctx)),
  );
