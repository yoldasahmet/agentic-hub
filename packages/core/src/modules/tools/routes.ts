import { toolGuardrailsSchema } from "@agentic/contracts";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { ToolService } from "./service";

/** `/tools`: the catalog for pickers, and the workspace guardrails. */
export const toolRoutes = (tools: ToolService) =>
  new Hono<AppEnv>()
    .get("/", async (c) => c.json(await tools.catalog(c.var.ctx)))
    .get("/guardrails", async (c) => c.json(await tools.guardrails(c.var.ctx)))
    .put("/guardrails", validate("json", toolGuardrailsSchema), async (c) =>
      c.json(await tools.setGuardrails(c.var.ctx, c.req.valid("json"))),
    );
