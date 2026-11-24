import {
  forkThreadInputSchema,
  historyQuerySchema,
  threadIdParamSchema,
  threadListQuerySchema,
  updateStateInputSchema,
} from "@agentic/contracts";
import type { GraphRuntime } from "@agentic/graph";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";

/** Threads and their checkpointed state: get, history, update (as node), fork. */
export const threadRoutes = ({ threads }: GraphRuntime) =>
  new Hono<AppEnv>()
    .get("/", validate("query", threadListQuerySchema), async (c) =>
      c.json(await threads.list(c.var.ctx, c.req.valid("query"))),
    )
    .get("/:threadId/state", validate("param", threadIdParamSchema), async (c) =>
      c.json(await threads.state(c.var.ctx, c.req.valid("param").threadId)),
    )
    .post(
      "/:threadId/state",
      validate("param", threadIdParamSchema),
      validate("json", updateStateInputSchema),
      async (c) =>
        c.json(
          await threads.updateState(c.var.ctx, c.req.valid("param").threadId, c.req.valid("json")),
        ),
    )
    .get(
      "/:threadId/history",
      validate("param", threadIdParamSchema),
      validate("query", historyQuerySchema),
      async (c) =>
        c.json(
          await threads.history(c.var.ctx, c.req.valid("param").threadId, c.req.valid("query")),
        ),
    )
    .post(
      "/:threadId/fork",
      validate("param", threadIdParamSchema),
      validate("json", forkThreadInputSchema),
      async (c) =>
        c.json(
          await threads.fork(c.var.ctx, c.req.valid("param").threadId, c.req.valid("json")),
          201,
        ),
    );
