import type { CreateRunInput, ForkThreadInput, UpdateStateInput } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export const useAssistants = () => useCoreQuery(["assistants"], (c) => c.assistants());
export const useThreads = () => useCoreQuery(["threads"], (c) => c.threads.list());

export const useThreadRuns = (threadId: string) =>
  useCoreQuery(["threads", threadId, "runs"], (c) => c.runs.list({ threadId, limit: 20 }));

export const useThreadHistory = (threadId: string) =>
  useCoreQuery(["threads", threadId, "history"], (c) =>
    c.threads.history(threadId, { limit: 100 }),
  );

export const useCreateRun = () =>
  useCoreMutation((c, input: CreateRunInput) => c.runs.create(input));

export const useCancelRun = () => useCoreMutation((c, runId: string) => c.runs.cancel(runId));

export const useUpdateState = () =>
  useCoreMutation((c, { threadId, input }: { threadId: string; input: UpdateStateInput }) =>
    c.threads.updateState(threadId, input),
  );

export const useForkThread = () =>
  useCoreMutation((c, { threadId, input }: { threadId: string; input: ForkThreadInput }) =>
    c.threads.fork(threadId, input),
  );
