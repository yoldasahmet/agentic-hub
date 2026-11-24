import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseCheckpointSaver, CheckpointTuple } from "@langchain/langgraph";
import type { PendingWrite } from "@langchain/langgraph-checkpoint";
import { threadConfig } from "./checkpoint-mapper";

/**
 * Copies one checkpoint (values, versions, and pending writes such as an
 * interrupt) into another thread. The copy has no parent, so the fork's
 * history starts at the chosen point and runs on independently. Without
 * the pending writes, the step runs again from scratch.
 */
export async function copyCheckpoint(
  saver: BaseCheckpointSaver,
  tuple: CheckpointTuple,
  threadId: string,
  keepPendingWrites = true,
): Promise<RunnableConfig> {
  const target = await saver.put(
    threadConfig(threadId),
    tuple.checkpoint,
    { source: "fork", step: tuple.metadata?.step ?? -1, parents: {} },
    tuple.checkpoint.channel_versions,
  );
  const byTask = new Map<string, PendingWrite[]>();
  for (const [taskId, channel, value] of keepPendingWrites ? (tuple.pendingWrites ?? []) : []) {
    byTask.set(taskId, [...(byTask.get(taskId) ?? []), [channel, value]]);
  }
  for (const [taskId, writes] of byTask) await saver.putWrites(target, writes, taskId);
  return target;
}
