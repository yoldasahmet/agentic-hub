import {
  createWorkflowInputSchema,
  exportAgentQuerySchema,
  importAgentInputSchema,
  publishWorkflowInputSchema,
  retryWorkflowRunInputSchema,
  runIdParamSchema,
  runWorkflowInputSchema,
  templateSlugParamSchema,
  updateWorkflowInputSchema,
  workflowIdParamSchema,
  workflowListQuerySchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { WorkflowModule } from "./index";

const archiveInputSchema = z.object({ archived: z.boolean() });
const id = workflowIdParamSchema;

/** Workflows: CRUD, autosave with validation, publish, runs, retry, templates, bundles. */
export const workflowRoutes = ({ service, runner, library }: WorkflowModule) =>
  new Hono<AppEnv>()
    .get("/", validate("query", workflowListQuerySchema), async (c) =>
      c.json(await service.list(c.var.ctx, c.req.valid("query"))),
    )
    .post("/", validate("json", createWorkflowInputSchema), async (c) =>
      c.json(await service.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .post("/import", validate("json", importAgentInputSchema), async (c) =>
      c.json(await library.import(c.var.ctx, c.req.valid("json")), 201),
    )
    .get("/templates", async (c) => c.json(await library.templates(c.var.ctx)))
    .post("/templates/:slug/install", validate("param", templateSlugParamSchema), async (c) =>
      c.json(await library.installTemplate(c.var.ctx, c.req.valid("param").slug), 201),
    )
    .post(
      "/runs/:runId/retry",
      validate("param", runIdParamSchema),
      validate("json", retryWorkflowRunInputSchema),
      async (c) =>
        c.json(await runner.retry(c.var.ctx, c.req.valid("param").runId, c.req.valid("json")), 201),
    )
    .get("/runs/:runId/document", validate("param", runIdParamSchema), async (c) =>
      c.json(await runner.document(c.var.ctx, c.req.valid("param").runId)),
    )
    .get("/:workflowId", validate("param", id), async (c) =>
      c.json(await service.get(c.var.ctx, c.req.valid("param").workflowId)),
    )
    .patch(
      "/:workflowId",
      validate("param", id),
      validate("json", updateWorkflowInputSchema),
      async (c) =>
        c.json(
          await service.update(c.var.ctx, c.req.valid("param").workflowId, c.req.valid("json")),
        ),
    )
    .get("/:workflowId/validate", validate("param", id), async (c) =>
      c.json(await service.validate(c.var.ctx, c.req.valid("param").workflowId)),
    )
    .post(
      "/:workflowId/archive",
      validate("param", id),
      validate("json", archiveInputSchema),
      async (c) => {
        const { archived } = c.req.valid("json");
        return c.json(
          await service.setArchived(c.var.ctx, c.req.valid("param").workflowId, archived),
        );
      },
    )
    .post("/:workflowId/duplicate", validate("param", id), async (c) =>
      c.json(await library.duplicate(c.var.ctx, c.req.valid("param").workflowId), 201),
    )
    .get(
      "/:workflowId/export",
      validate("param", id),
      validate("query", exportAgentQuerySchema),
      async (c) => {
        const { format } = c.req.valid("query");
        return c.json(await library.export(c.var.ctx, c.req.valid("param").workflowId, format));
      },
    )
    .get("/:workflowId/versions", validate("param", id), async (c) =>
      c.json(await service.versions(c.var.ctx, c.req.valid("param").workflowId)),
    )
    .post(
      "/:workflowId/publish",
      validate("param", id),
      validate("json", publishWorkflowInputSchema),
      async (c) => {
        const { revision } = c.req.valid("json");
        return c.json(
          await service.publish(c.var.ctx, c.req.valid("param").workflowId, revision),
          201,
        );
      },
    )
    .post(
      "/:workflowId/runs",
      validate("param", id),
      validate("json", runWorkflowInputSchema),
      async (c) =>
        c.json(
          await runner.run(c.var.ctx, c.req.valid("param").workflowId, c.req.valid("json")),
          201,
        ),
    );
