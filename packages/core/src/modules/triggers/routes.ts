import {
  createTriggerInputSchema,
  triggerIdParamSchema,
  updateTriggerInputSchema,
  workflowIdParamSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { TriggerService } from "./service";

/** `/triggers`: list and create per workflow, edit, delete, and fire now. */
export const triggerRoutes = (triggers: TriggerService) =>
  new Hono<AppEnv>()
    .get("/workflow/:workflowId", validate("param", workflowIdParamSchema), async (c) =>
      c.json(await triggers.list(c.var.ctx, c.req.valid("param").workflowId)),
    )
    .post(
      "/workflow/:workflowId",
      validate("param", workflowIdParamSchema),
      validate("json", createTriggerInputSchema),
      async (c) =>
        c.json(
          await triggers.create(c.var.ctx, c.req.valid("param").workflowId, c.req.valid("json")),
          201,
        ),
    )
    .patch(
      "/:triggerId",
      validate("param", triggerIdParamSchema),
      validate("json", updateTriggerInputSchema),
      async (c) =>
        c.json(
          await triggers.update(c.var.ctx, c.req.valid("param").triggerId, c.req.valid("json")),
        ),
    )
    .delete("/:triggerId", validate("param", triggerIdParamSchema), async (c) => {
      await triggers.remove(c.var.ctx, c.req.valid("param").triggerId);
      return c.json({ ok: true });
    })
    .post("/:triggerId/fire", validate("param", triggerIdParamSchema), async (c) =>
      c.json(await triggers.fire(c.var.ctx, c.req.valid("param").triggerId), 201),
    );
