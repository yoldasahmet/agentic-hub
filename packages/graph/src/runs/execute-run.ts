import { AppError } from "@agentic/contracts";
import { moduleLogger, withLogContext } from "@agentic/logger";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { AssistantRegistry } from "../assistants/registry";
import type { RunnableGraph } from "../assistants/runnable-graph";
import type { EventLog } from "../events/event-log";
import { mapStreamChunk } from "../events/map-stream";
import type { JobRow } from "../jobs/job-queue";
import type { JobHandler } from "../jobs/worker";
import { abortReasons } from "../jobs/worker";
import { toJsonRecord } from "../lib/json";
import { liveInterrupts, threadConfig } from "../state/checkpoint-mapper";
import { ALREADY_DONE, resolveRunInput } from "./run-input";
import { runJobPayloadSchema } from "./run-job";
import { isTerminal, type RunLifecycle } from "./run-lifecycle";
import type { RunRow, RunStore } from "./run-store";

const log = moduleLogger("graph.runs");

type Deps = {
  registry: AssistantRegistry;
  checkpointer: BaseCheckpointSaver;
  runs: RunStore;
  events: EventLog;
  lifecycle: RunLifecycle;
};

/**
 * The `run` job: streams the pinned graph on the run's thread, turns each
 * chunk into persisted events, and settles the run as waiting (a gate),
 * succeeded, failed, or canceled. Shutdown and lost leases leave the run
 * `running`, so the next holder of the job continues it.
 */
export function createRunJobHandler(deps: Deps): JobHandler {
  return async (job, signal) => {
    const run = job.runId ? await deps.runs.getById(job.runId) : undefined;
    if (!run || isTerminal(run.status)) return;
    return withLogContext({ runId: run.id, threadId: run.threadId }, () =>
      executeRun(deps, run, job, signal),
    );
  };
}

async function executeRun(
  deps: Deps,
  run: RunRow,
  job: JobRow,
  signal: AbortSignal,
): Promise<void> {
  const payload = runJobPayloadSchema.parse(job.payload);
  const graph = await deps.registry.graph(run.assistantId ?? "", run.targetVersion ?? 1);
  const input = await resolveRunInput(graph, run, payload, job.attempts);

  const running = run.status === "running" ? run : await deps.lifecycle.transition(run, "running");
  try {
    if (input !== ALREADY_DONE) await streamRun(deps, graph, running, input, signal);
    await settle(deps, graph, running);
  } catch (err) {
    if (signal.aborted && signal.reason === abortReasons.cancel) {
      await deps.lifecycle.transition(running, "canceled");
    } else if (!signal.aborted) {
      log.error({ err }, "run threw");
      await deps.lifecycle.transition(running, "failed", { error: AppError.from(err).toJSON() });
      return;
    }
    throw err;
  }
}

async function streamRun(
  deps: Deps,
  graph: RunnableGraph,
  run: RunRow,
  input: unknown,
  signal: AbortSignal,
): Promise<void> {
  const config = threadConfig(run.threadId);
  // Nodes resolve workspace data (MCP servers, skills, guardrails) and the run's worktree from here.
  config.configurable = {
    ...config.configurable,
    workspace_id: run.workspaceId,
    run_id: run.id,
  };
  const stream = await graph.stream(input, {
    ...config,
    streamMode: ["updates", "messages", "custom"],
    signal,
  });
  for await (const chunk of stream) {
    for (const draft of mapStreamChunk(chunk)) await deps.events.append(run, draft);
  }
}

/** Reads the final state: pending interrupts mean a gate, anything else is done. */
async function settle(deps: Deps, graph: RunnableGraph, run: RunRow): Promise<void> {
  const state = await graph.getState(threadConfig(run.threadId));
  const interrupts = await liveInterrupts(deps.checkpointer, state);
  if (interrupts.length > 0) {
    await deps.lifecycle.transition(run, "waiting", {
      events: [{ type: "run.interrupted", payload: { interrupts } }],
    });
    return;
  }
  const output = toJsonRecord(state.values);
  await deps.lifecycle.transition(run, "succeeded", {
    output,
    events: [{ type: "run.output", payload: { output } }],
  });
}
