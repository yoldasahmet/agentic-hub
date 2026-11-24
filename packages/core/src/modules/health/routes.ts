import type { Health } from "@agentic/contracts";
import { Hono } from "hono";

/** Unauthenticated liveness check for the CLI and supervisors. */
export const healthRoutes = (version: string) =>
  new Hono().get("/", (c) => c.json<Health>({ status: "ok", version }));
