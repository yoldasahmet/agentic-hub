import type { AppErrorShape, RunEventDraft, RunStatus, ThreadStatus } from "@agentic/contracts";
import { moduleLogger, withLogContext } from "@agentic/logger";
import type { EventBus } from "../events/event-bus";
import type { EventLog } from "../events/event-log";
import type { ThreadStore } from "../threads/thread-store";
import { type RunPatch, type RunRow, type RunStore, toRun } from "./run-store";

const log = moduleLogger("graph.runs");
const TERMINAL: RunStatus[] = ["succeeded", "failed", "canceled"];
const THREAD_STATUS: Record<RunStatus, ThreadStatus> = {
  queued: "busy",
  running: "busy",
  waiting: "interrupted",
  succeeded: "idle",
  canceled: "idle",
  failed: "error",
};

type Change = { output?: unknown; error?: AppErrorShape; events?: RunEventDraft[] };

/**
 * The one place a run changes status: it updates the row and the thread
 * status, persists the events plus a `run.status` event, then broadcasts
 * the run so lists and the Inbox refresh.
 */
export class RunLifecycle {
  constructor(
    private readonly runs: RunStore,
    private readonly threads: ThreadStore,
    private readonly events: EventLog,
    private readonly bus: EventBus,
  ) {}

  async transition(row: RunRow, status: RunStatus, change: Change = {}): Promise<RunRow> {
    const patch: RunPatch = { status, finishedAt: TERMINAL.includes(status) ? new Date() : null };
    if (status === "running" && !row.startedAt) patch.startedAt = new Date();
    if (change.output !== undefined) patch.output = change.output;
    if (status === "queued" || status === "running") patch.error = null;
    if (change.error) patch.error = change.error;

    const updated = await this.runs.update(row.id, patch);
    await this.threads.setStatus(row.threadId, THREAD_STATUS[status]);
    for (const draft of change.events ?? []) await this.events.append(updated, draft);
    await this.events.append(updated, {
      type: "run.status",
      payload: change.error ? { status, error: change.error } : { status },
    });
    this.bus.publish({ kind: "run", workspaceId: updated.workspaceId, run: toRun(updated) });
    logTransition(row, status, change.error);
    return updated;
  }
}

export const isTerminal = (status: string): boolean => TERMINAL.some((s) => s === status);

function logTransition(row: RunRow, status: RunStatus, error: AppErrorShape | undefined): void {
  withLogContext({ runId: row.id, threadId: row.threadId }, () => {
    const fields = { from: row.status, status, assistantId: row.assistantId };
    if (status === "failed") log.warn({ ...fields, error }, "run failed");
    else log.info(fields, `run ${status}`);
  });
}
