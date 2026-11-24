import { StateInspector, toast } from "@agentic/ui";
import { useRunEventsRefresh } from "../../lib/core-queries";
import { showError } from "../../lib/show-error";
import { ContinueThreadCard } from "./continue-thread-card";
import {
  useAssistants,
  useForkThread,
  useThreadHistory,
  useThreadRuns,
  useThreads,
  useUpdateState,
} from "./queries";
import { RunHeader } from "./run-header";

type Props = { threadId: string; onForked: (threadId: string) => void };

/** One thread: its latest run and the StateInspector over its checkpoints. */
export function ThreadPanel({ threadId, onForked }: Props) {
  const thread = useThreads().data?.find((t) => t.id === threadId);
  const latest = useThreadRuns(threadId).data?.[0];
  const history = useThreadHistory(threadId).data ?? [];
  const head = history[0];
  const nodes = useAssistants().data?.find((a) => a.id === thread?.assistantId)?.nodes ?? [];
  const update = useUpdateState();
  const fork = useForkThread();
  useRunEventsRefresh(latest?.id);
  const executing = latest?.status === "queued" || latest?.status === "running";
  const ownsThread = executing || latest?.status === "waiting";
  const canContinue = !ownsThread && head !== undefined && head.next.length > 0;
  const onError = (err: Error) => showError(err);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      {latest && <RunHeader run={latest} interrupts={head?.interrupts ?? []} />}
      {thread && head && canContinue && (
        <ContinueThreadCard threadId={threadId} assistantId={thread.assistantId} head={head} />
      )}
      <StateInspector
        key={threadId}
        checkpoints={history}
        nodes={nodes}
        busy={update.isPending || fork.isPending}
        canEdit={!executing}
        onSave={(values, asNode) =>
          update.mutate(
            { threadId, input: { values, asNode } },
            { onSuccess: () => toast.success("Saved a new checkpoint"), onError },
          )
        }
        onFork={(checkpointId) =>
          fork.mutate(
            { threadId, input: { checkpointId } },
            { onSuccess: (thread) => onForked(thread.id), onError },
          )
        }
      />
    </div>
  );
}
