import { type Checkpoint, checkpointSchema, type Interrupt } from "@agentic/contracts";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseCheckpointSaver, StateSnapshot } from "@langchain/langgraph";
import { z } from "zod";
import { toJsonRecord, toJsonSafe } from "../lib/json";

const configSchema = z.object({
  configurable: z.object({ checkpoint_id: z.string().optional() }).loose().optional(),
});
const metadataSchema = z
  .object({
    step: z.number().optional(),
    source: z.string().optional(),
    writes: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .loose();

/** The LangGraph config that addresses a thread, or one checkpoint in it. */
export function threadConfig(threadId: string, checkpointId?: string): RunnableConfig {
  return {
    configurable: {
      thread_id: threadId,
      checkpoint_ns: "",
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
  };
}

export function checkpointIdOf(config: RunnableConfig | undefined): string | null {
  return configSchema.safeParse(config).data?.configurable?.checkpoint_id ?? null;
}

/** Channels LangGraph writes for its own bookkeeping, not as a task's result. */
const BOOKKEEPING = new Set(["__interrupt__", "__resume__", "__error__", "__scheduled__"]);

/** `finished`: tasks of this step that completed after their interrupt was answered. */
export function interruptsOf(snapshot: StateSnapshot, finished = new Set<string>()): Interrupt[] {
  return snapshot.tasks
    .filter((task) => !finished.has(task.id))
    .flatMap((task) =>
      task.interrupts.map((i) => ({
        id: i.id ?? task.id,
        node: task.name,
        value: toJsonSafe(i.value),
      })),
    );
}

/**
 * The interrupts still waiting. When parallel branches each hit a gate and
 * one is answered, LangGraph keeps that task's old interrupt write next to
 * its result until the whole step finishes; tasks with a result are done.
 */
export async function liveInterrupts(
  checkpointer: BaseCheckpointSaver,
  snapshot: StateSnapshot,
): Promise<Interrupt[]> {
  if (snapshot.tasks.filter((task) => task.interrupts.length > 0).length < 2) {
    return interruptsOf(snapshot);
  }
  const tuple = await checkpointer.getTuple(snapshot.config);
  const finished = new Set(
    (tuple?.pendingWrites ?? [])
      .filter(([, channel]) => !BOOKKEEPING.has(channel))
      .map(([id]) => id),
  );
  return interruptsOf(snapshot, finished);
}

/** Maps a snapshot to the API shape. `null` when the thread has no checkpoint yet. */
export function toCheckpoint(
  snapshot: StateSnapshot,
  interrupts: Interrupt[] = interruptsOf(snapshot),
): Checkpoint | null {
  const checkpointId = checkpointIdOf(snapshot.config);
  if (!checkpointId) return null;
  const metadata = metadataSchema.safeParse(snapshot.metadata ?? {}).data;
  return checkpointSchema.parse({
    checkpointId,
    parentCheckpointId: checkpointIdOf(snapshot.parentConfig),
    values: toJsonRecord(snapshot.values),
    next: [...snapshot.next],
    interrupts,
    step: metadata?.step ?? -1,
    source: metadata?.source ?? "unknown",
    writes: metadata?.writes ? toJsonRecord(metadata.writes) : null,
    createdAt: snapshot.createdAt ?? null,
  });
}
