import {
  createRunInputSchema,
  resumeRunInputSchema,
  runEventsQuerySchema,
  runIdParamSchema,
  runListQuerySchema,
  waitQuerySchema,
} from "@agentic/contracts";
import type { GraphRuntime } from "@agentic/graph";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";

/**
 * Runs, shaped like the LangGraph Platform API: create, wait, cancel,
 * resume a gate, and read persisted events (WS streams them live).
 */
export const runRoutes = (graph: GraphRuntime) => {
  const { runs } = graph;
  return new Hono<AppEnv>()
    .get("/", validate("query", runListQuerySchema), async (c) =>
      c.json(await runs.list(c.var.ctx, c.req.valid("query"))),
    )
    .post("/", validate("json", createRunInputSchema), async (c) =>
      c.json(await runs.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .post(
      "/wait",
      validate("json", createRunInputSchema),
      validate("query", waitQuerySchema),
      async (c) => {
        const run = await runs.create(c.var.ctx, c.req.valid("json"));
        return c.json(await graph.waitForRun(c.var.ctx, run.id, c.req.valid("query").timeoutMs));
      },
    )
    .get("/:runId", validate("param", runIdParamSchema), async (c) =>
      c.json(await runs.get(c.var.ctx, c.req.valid("param").runId)),
    )
    .get(
      "/:runId/wait",
      validate("param", runIdParamSchema),
      validate("query", waitQuerySchema),
      async (c) => {
        const { runId } = c.req.valid("param");
        return c.json(await graph.waitForRun(c.var.ctx, runId, c.req.valid("query").timeoutMs));
      },
    )
    .post("/:runId/cancel", validate("param", runIdParamSchema), async (c) =>
      c.json(await runs.cancel(c.var.ctx, c.req.valid("param").runId)),
    )
    .post(
      "/:runId/resume",
      validate("param", runIdParamSchema),
      validate("json", resumeRunInputSchema),
      async (c) => {
        const { resume, interruptId } = c.req.valid("json");
        return c.json(
          await runs.resume(c.var.ctx, c.req.valid("param").runId, resume, interruptId),
        );
      },
    )
    .get(
      "/:runId/events",
      validate("param", runIdParamSchema),
      validate("query", runEventsQuerySchema),
      async (c) => {
        const { after, limit } = c.req.valid("query");
        const items = await runs.events(c.var.ctx, c.req.valid("param").runId, after, limit);
        return c.json({ items, lastSeq: items.at(-1)?.seq ?? after });
      },
    );
};
