import {
  type AgentTestInput,
  agentAssistantId,
  agentDraftAssistantId,
  type BundleFormat,
  type CreateAgentInput,
  type ImportAgentInput,
  type JsonValue,
  type RunAgentInput,
} from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export const useAgents = (archived = false) =>
  useCoreQuery(archived ? ["agents", "archived"] : ["agents"], (c) => c.agents.list(archived));
export const useAgent = (id: string) => useCoreQuery(["agents", id], (c) => c.agents.get(id));
export const useAgentVersions = (id: string) =>
  useCoreQuery(["agents", id, "versions"], (c) => c.agents.versions(id));
export const useBuiltinAgents = () =>
  useCoreQuery(["agents", "builtins"], (c) => c.agents.builtins());
export const useTestInputs = (id: string) =>
  useCoreQuery(["agents", id, "test-inputs"], (c) => c.agents.testInputs(id));

/** Runs of the agent's draft and its versions, newest first (ids are UUIDv7). */
export const useAgentRuns = (id: string) =>
  useCoreQuery(["agents", id, "runs"], async (c) => {
    const [published, drafts] = await Promise.all([
      c.runs.list({ assistantId: agentAssistantId(id), limit: 20 }),
      c.runs.list({ assistantId: agentDraftAssistantId(id), limit: 20 }),
    ]);
    return [...published, ...drafts].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 20);
  });

export const useThreadState = (threadId: string | undefined) =>
  useCoreQuery(["threads", threadId, "state"], (c) => c.threads.state(threadId ?? ""), !!threadId);

export const useCreateAgent = () =>
  useCoreMutation((c, input: CreateAgentInput) => c.agents.create(input));
export const usePublishAgent = () =>
  useCoreMutation((c, { id, revision }: { id: string; revision: number }) =>
    c.agents.publish(id, revision),
  );
export const useArchiveAgent = () =>
  useCoreMutation((c, id: string) => c.agents.setArchived(id, true));
export const useDuplicateAgent = () => useCoreMutation((c, id: string) => c.agents.duplicate(id));
export const useImportAgent = () =>
  useCoreMutation((c, input: ImportAgentInput) => c.agents.import(input));
export const useInstallBuiltin = () =>
  useCoreMutation((c, slug: string) => c.agents.installBuiltin(slug));
export const useExportAgent = () =>
  useCoreMutation((c, { id, format }: { id: string; format: BundleFormat }) =>
    c.agents.export(id, format),
  );
export const useRunAgent = () =>
  useCoreMutation((c, { id, input }: { id: string; input: RunAgentInput }) =>
    c.agents.run(id, input),
  );
export const useSetTestInputs = () =>
  useCoreMutation((c, { id, inputs }: { id: string; inputs: AgentTestInput[] }) =>
    c.agents.setTestInputs(id, inputs),
  );
export const useResumeRun = () =>
  useCoreMutation((c, { runId, resume }: { runId: string; resume: JsonValue }) =>
    c.runs.resume(runId, resume),
  );
export const useEditOutput = () =>
  useCoreMutation(
    (c, { threadId, output }: { threadId: string; output: Record<string, unknown> }) =>
      c.threads.updateState(threadId, { values: { output }, asNode: "agent" }),
  );
