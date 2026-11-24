import {
  agentExportSchema,
  type BundleFormat,
  type CreateTriggerInput,
  type CreateWorkflowInput,
  type ImportAgentInput,
  type RetryWorkflowRunInput,
  type RunWorkflowInput,
  runSchema,
  savedWorkflowSchema,
  triggerSchema,
  type UpdateTriggerInput,
  type UpdateWorkflowInput,
  validationIssueSchema,
  workflowDocumentSchema,
  workflowSchema,
  workflowTemplateSchema,
  workflowVersionSchema,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

/** Workflows, versions, runs, templates, bundles (`/workflows`), and triggers (`/triggers`). */
export function createWorkflowsClient(api: Api) {
  const workflow = api.workflows[":workflowId"];
  const param = (workflowId: string) => ({ param: { workflowId } });
  const trigger = api.triggers[":triggerId"];
  const triggerParam = (triggerId: string) => ({ param: { triggerId } });
  return {
    list: async (archived = false) =>
      parseResponse(
        await api.workflows.$get({ query: { archived: archived ? "1" : "0" } }),
        z.array(workflowSchema),
      ),
    get: async (id: string) => parseResponse(await workflow.$get(param(id)), workflowSchema),
    create: async (json: CreateWorkflowInput) =>
      parseResponse(await api.workflows.$post({ json }), workflowSchema),
    update: async (id: string, json: UpdateWorkflowInput) =>
      parseResponse(await workflow.$patch({ ...param(id), json }), savedWorkflowSchema),
    validate: async (id: string) =>
      parseResponse(await workflow.validate.$get(param(id)), z.array(validationIssueSchema)),
    setArchived: async (id: string, archived: boolean) =>
      parseResponse(
        await workflow.archive.$post({ ...param(id), json: { archived } }),
        workflowSchema,
      ),
    duplicate: async (id: string) =>
      parseResponse(await workflow.duplicate.$post(param(id)), workflowSchema),
    publish: async (id: string, revision: number) =>
      parseResponse(
        await workflow.publish.$post({ ...param(id), json: { revision } }),
        workflowVersionSchema,
      ),
    versions: async (id: string) =>
      parseResponse(await workflow.versions.$get(param(id)), z.array(workflowVersionSchema)),
    run: async (id: string, json: RunWorkflowInput) =>
      parseResponse(await workflow.runs.$post({ ...param(id), json }), runSchema),
    retry: async (runId: string, json: RetryWorkflowRunInput = {}) =>
      parseResponse(
        await api.workflows.runs[":runId"].retry.$post({ param: { runId }, json }),
        runSchema,
      ),
    runDocument: async (runId: string) =>
      parseResponse(
        await api.workflows.runs[":runId"].document.$get({ param: { runId } }),
        workflowDocumentSchema,
      ),
    export: async (id: string, format: BundleFormat) =>
      parseResponse(
        await workflow.export.$get({ ...param(id), query: { format } }),
        agentExportSchema,
      ),
    import: async (json: ImportAgentInput) =>
      parseResponse(await api.workflows.import.$post({ json }), workflowSchema),
    templates: async () =>
      parseResponse(await api.workflows.templates.$get(), z.array(workflowTemplateSchema)),
    installTemplate: async (slug: string) =>
      parseResponse(
        await api.workflows.templates[":slug"].install.$post({ param: { slug } }),
        workflowSchema,
      ),
    triggers: {
      list: async (workflowId: string) =>
        parseResponse(
          await api.triggers.workflow[":workflowId"].$get(param(workflowId)),
          z.array(triggerSchema),
        ),
      create: async (workflowId: string, json: CreateTriggerInput) =>
        parseResponse(
          await api.triggers.workflow[":workflowId"].$post({ ...param(workflowId), json }),
          triggerSchema,
        ),
      update: async (triggerId: string, json: UpdateTriggerInput) =>
        parseResponse(await trigger.$patch({ ...triggerParam(triggerId), json }), triggerSchema),
      remove: async (triggerId: string) =>
        parseResponse(
          await trigger.$delete(triggerParam(triggerId)),
          z.object({ ok: z.boolean() }),
        ),
      fire: async (triggerId: string) =>
        parseResponse(await trigger.fire.$post(triggerParam(triggerId)), runSchema),
    },
  };
}
