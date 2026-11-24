import {
  agentIdParamSchema,
  agentListQuerySchema,
  agentTestInputsSchema,
  builtinSlugParamSchema,
  createAgentInputSchema,
  exportAgentQuerySchema,
  importAgentInputSchema,
  publishAgentInputSchema,
  runAgentInputSchema,
  updateAgentInputSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { AgentLibrary } from "./library";
import type { AgentService } from "./service";

const archiveInputSchema = z.object({ archived: z.boolean() });

/** Agents: CRUD, draft autosave, publish, versions, runs, and the library. */
export const agentRoutes = (agents: AgentService, library: AgentLibrary) =>
  new Hono<AppEnv>()
    .get("/", validate("query", agentListQuerySchema), async (c) =>
      c.json(await agents.list(c.var.ctx, c.req.valid("query"))),
    )
    .post("/", validate("json", createAgentInputSchema), async (c) =>
      c.json(await agents.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .post("/import", validate("json", importAgentInputSchema), async (c) =>
      c.json(await library.import(c.var.ctx, c.req.valid("json")), 201),
    )
    .get("/builtins", async (c) => c.json(await library.builtins(c.var.ctx)))
    .post("/builtins/:slug/install", validate("param", builtinSlugParamSchema), async (c) =>
      c.json(await library.installBuiltin(c.var.ctx, c.req.valid("param").slug), 201),
    )
    .get("/:agentId", validate("param", agentIdParamSchema), async (c) =>
      c.json(await agents.get(c.var.ctx, c.req.valid("param").agentId)),
    )
    .patch(
      "/:agentId",
      validate("param", agentIdParamSchema),
      validate("json", updateAgentInputSchema),
      async (c) =>
        c.json(await agents.update(c.var.ctx, c.req.valid("param").agentId, c.req.valid("json"))),
    )
    .post(
      "/:agentId/archive",
      validate("param", agentIdParamSchema),
      validate("json", archiveInputSchema),
      async (c) => {
        const { archived } = c.req.valid("json");
        return c.json(await agents.setArchived(c.var.ctx, c.req.valid("param").agentId, archived));
      },
    )
    .post("/:agentId/duplicate", validate("param", agentIdParamSchema), async (c) =>
      c.json(await library.duplicate(c.var.ctx, c.req.valid("param").agentId), 201),
    )
    .get(
      "/:agentId/export",
      validate("param", agentIdParamSchema),
      validate("query", exportAgentQuerySchema),
      async (c) => {
        const { format } = c.req.valid("query");
        return c.json(await library.export(c.var.ctx, c.req.valid("param").agentId, format));
      },
    )
    .get("/:agentId/versions", validate("param", agentIdParamSchema), async (c) =>
      c.json(await agents.versions(c.var.ctx, c.req.valid("param").agentId)),
    )
    .post(
      "/:agentId/publish",
      validate("param", agentIdParamSchema),
      validate("json", publishAgentInputSchema),
      async (c) => {
        const { revision } = c.req.valid("json");
        return c.json(await agents.publish(c.var.ctx, c.req.valid("param").agentId, revision), 201);
      },
    )
    .post(
      "/:agentId/runs",
      validate("param", agentIdParamSchema),
      validate("json", runAgentInputSchema),
      async (c) =>
        c.json(await agents.run(c.var.ctx, c.req.valid("param").agentId, c.req.valid("json")), 201),
    )
    .get("/:agentId/test-inputs", validate("param", agentIdParamSchema), async (c) =>
      c.json(await agents.testInputs(c.var.ctx, c.req.valid("param").agentId)),
    )
    .put(
      "/:agentId/test-inputs",
      validate("param", agentIdParamSchema),
      validate("json", agentTestInputsSchema),
      async (c) =>
        c.json(
          await agents.setTestInputs(c.var.ctx, c.req.valid("param").agentId, c.req.valid("json")),
        ),
    );
