import {
  type BundleFormat,
  type CreateTriggerInput,
  type CreateWorkflowInput,
  type ImportAgentInput,
  type JsonValue,
  type RetryWorkflowRunInput,
  type RunWorkflowInput,
  type UpdateTriggerInput,
  workflowAssistantId,
  workflowDraftAssistantId,
} from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export const useWorkflows = () => useCoreQuery(["workflows"], (c) => c.workflows.list());
export const useWorkflow = (id: string) =>
  useCoreQuery(["workflows", id], (c) => c.workflows.get(id));
export const useWorkflowVersions = (id: string) =>
  useCoreQuery(["workflows", id, "versions"], (c) => c.workflows.versions(id));
export const useWorkflowTemplates = () =>
  useCoreQuery(["workflows", "templates"], (c) => c.workflows.templates());
export const useTriggers = (id: string) =>
  useCoreQuery(["workflows", id, "triggers"], (c) => c.workflows.triggers.list(id));

/** Runs of the workflow's draft and versions, newest first (ids are UUIDv7). */
export const useWorkflowRuns = (id: string) =>
  useCoreQuery(["workflows", id, "runs"], async (c) => {
    const [published, drafts] = await Promise.all([
      c.runs.list({ assistantId: workflowAssistantId(id), limit: 50 }),
      c.runs.list({ assistantId: workflowDraftAssistantId(id), limit: 50 }),
    ]);
    return [...published, ...drafts].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 50);
  });

export const useCreateWorkflow = () =>
  useCoreMutation((c, input: CreateWorkflowInput) => c.workflows.create(input));
export const usePublishWorkflow = () =>
  useCoreMutation((c, { id, revision }: { id: string; revision: number }) =>
    c.workflows.publish(id, revision),
  );
export const useArchiveWorkflow = () =>
  useCoreMutation((c, id: string) => c.workflows.setArchived(id, true));
export const useDuplicateWorkflow = () =>
  useCoreMutation((c, id: string) => c.workflows.duplicate(id));
export const useImportWorkflow = () =>
  useCoreMutation((c, input: ImportAgentInput) => c.workflows.import(input));
export const useInstallTemplate = () =>
  useCoreMutation((c, slug: string) => c.workflows.installTemplate(slug));
export const useExportWorkflow = () =>
  useCoreMutation((c, { id, format }: { id: string; format: BundleFormat }) =>
    c.workflows.export(id, format),
  );
export const useRunWorkflow = () =>
  useCoreMutation((c, { id, input }: { id: string; input: RunWorkflowInput }) =>
    c.workflows.run(id, input),
  );
export const useRetryRun = () =>
  useCoreMutation((c, { runId, input }: { runId: string; input: RetryWorkflowRunInput }) =>
    c.workflows.retry(runId, input),
  );
export const useCancelRun = () => useCoreMutation((c, runId: string) => c.runs.cancel(runId));
export const useAnswerGate = () =>
  useCoreMutation(
    (
      c,
      { runId, resume, interruptId }: { runId: string; resume: JsonValue; interruptId?: string },
    ) => c.runs.resume(runId, resume, interruptId),
  );
export const useCreateTrigger = () =>
  useCoreMutation((c, { id, input }: { id: string; input: CreateTriggerInput }) =>
    c.workflows.triggers.create(id, input),
  );
export const useUpdateTrigger = () =>
  useCoreMutation((c, { id, input }: { id: string; input: UpdateTriggerInput }) =>
    c.workflows.triggers.update(id, input),
  );
export const useRemoveTrigger = () =>
  useCoreMutation((c, id: string) => c.workflows.triggers.remove(id));
export const useFireTrigger = () =>
  useCoreMutation((c, id: string) => c.workflows.triggers.fire(id));
