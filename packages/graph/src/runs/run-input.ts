import { Command } from "@langchain/langgraph";
import type { RunnableGraph } from "../assistants/runnable-graph";
import { checkpointIdOf, threadConfig } from "../state/checkpoint-mapper";
import type { RunJobPayload } from "./run-job";
import type { RunRow } from "./run-store";

/** The job has nothing left to execute: only the final state needs reporting. */
export const ALREADY_DONE = Symbol("already-done");

/**
 * What to pass to `graph.stream`. A first attempt uses the job's input or
 * resume command. A retry after a crash continues from the checkpoint the
 * first attempt reached, so finished nodes never run twice.
 */
export async function resolveRunInput(
  graph: RunnableGraph,
  run: RunRow,
  payload: RunJobPayload,
  attempt: number,
): Promise<unknown> {
  if (payload.mode === "continue") return null;
  const initial = payload.mode === "resume" ? resumeCommand(payload) : run.input;
  if (attempt <= 1) return initial;

  const state = await graph.getState(threadConfig(run.threadId));
  if (checkpointIdOf(state.config) === payload.fromCheckpointId) return initial;
  const pendingGate = state.tasks.some((task) => task.interrupts.length > 0);
  if (pendingGate || state.next.length === 0) return ALREADY_DONE;
  return null;
}

/** A resume value for one interrupt is keyed by its id; LangGraph resumes the others again. */
function resumeCommand({ resume, interruptId }: RunJobPayload): Command {
  return new Command({ resume: interruptId ? { [interruptId]: resume } : resume });
}
