import {
  AppError,
  type CreateRunInput,
  createRunInputSchema,
  type PendingInterrupt,
  type ResumeRunInput,
  type Run,
  type RunEvent,
  type RunListQuery,
} from "@agentic/contracts";
import type { Database, LocalContext } from "@agentic/db";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { AssistantRegistry } from "../assistants/registry";
import type { EventLog } from "../events/event-log";
import type { JobQueue } from "../jobs/job-queue";
import type { Worker } from "../jobs/worker";
import type { Tx } from "../lib/executor";
import { lockThread } from "../lib/thread-lock";
import { checkpointIdOf, liveInterrupts, threadConfig } from "../state/checkpoint-mapper";
import type { ThreadStore } from "../threads/thread-store";
import { RUN_JOB_KIND, type RunJobPayload } from "./run-job";
import { isTerminal, type RunLifecycle } from "./run-lifecycle";
import { type RunRow, type RunStore, toRun } from "./run-store";

export type RunServiceDeps = {
  db: Database;
  checkpointer: BaseCheckpointSaver;
  registry: AssistantRegistry;
  runs: RunStore;
  threads: ThreadStore;
  queue: JobQueue;
  worker: Worker;
  events: EventLog;
  lifecycle: RunLifecycle;
};

/** Start, resume, cancel, and read runs. One active run per thread. */
export class RunService {
  constructor(private readonly deps: RunServiceDeps) {}

  async create(ctx: LocalContext, raw: CreateRunInput): Promise<Run> {
    const input = createRunInputSchema.parse(raw);
    const { threads, runs } = this.deps;
    const row = await this.deps.db.transaction(async (tx) => {
      const thread = input.threadId
        ? await threads.get(ctx, input.threadId, tx)
        : await this.newThread(ctx, input.assistantId, input.assistantVersion, tx);
      if (thread.assistantId !== input.assistantId) {
        throw new AppError("conflict", `Thread ${thread.id} belongs to ${thread.assistantId}`);
      }
      await lockThread(tx, thread.id);
      const active = await runs.activeOnThread(thread.id, tx);
      if (active) throw new AppError("conflict", `Run ${active.id} is still active on this thread`);
      const head = await this.head(thread.assistantId, thread.assistantVersion, thread.id);
      const mode =
        input.resume !== undefined ? "resume" : input.input || !head ? "input" : "continue";
      const run = await runs.insert(
        ctx,
        { ...thread, threadId: thread.id, input: input.input ?? null },
        tx,
      );
      await this.enqueue(run, { mode, resume: input.resume, fromCheckpointId: head }, tx);
      return run;
    });
    return this.queued(row);
  }

  /** Answers the pending gate of a waiting run; the same run continues. */
  /** `interruptId` answers one of several gates that wait at once (parallel branches). */
  async resume(
    ctx: LocalContext,
    runId: string,
    resume: ResumeRunInput["resume"],
    interruptId?: string,
  ): Promise<Run> {
    const row = await this.deps.db.transaction(async (tx) => {
      const run = await this.deps.runs.get(ctx, runId, tx);
      await lockThread(tx, run.threadId);
      const current = await this.deps.runs.get(ctx, runId, tx);
      if (current.status !== "waiting") {
        throw new AppError("conflict", `Run ${runId} is ${current.status}, not waiting`);
      }
      const head = await this.head(
        current.assistantId ?? "",
        current.targetVersion ?? 1,
        current.threadId,
      );
      const payload = { mode: "resume" as const, resume, interruptId, fromCheckpointId: head };
      await this.enqueue(current, payload, tx);
      return this.deps.runs.update(runId, { status: "queued" }, tx);
    });
    return this.queued(row);
  }

  /**
   * After a state edit, a waiting run continues from the edited checkpoint:
   * its gate asks again with the new state, or it moves on if the edit
   * was written as the gate node.
   */
  async continueWaiting(runId: string): Promise<void> {
    const row = await this.deps.db.transaction(async (tx) => {
      const run = await this.deps.runs.getById(runId);
      if (!run) return undefined;
      await lockThread(tx, run.threadId);
      const current = await this.deps.runs.getById(runId);
      if (current?.status !== "waiting") return undefined;
      const head = await this.head(
        current.assistantId ?? "",
        current.targetVersion ?? 1,
        current.threadId,
      );
      await this.enqueue(current, { mode: "continue", fromCheckpointId: head }, tx);
      return this.deps.runs.update(runId, { status: "queued" }, tx);
    });
    if (row) await this.queued(row);
  }

  async cancel(ctx: LocalContext, runId: string): Promise<Run> {
    const run = await this.deps.runs.get(ctx, runId);
    if (isTerminal(run.status)) return toRun(run);
    const result = await this.deps.queue.requestCancel(run.id);
    if (result === "canceling") {
      this.deps.worker.cancelLocal(run.id);
      return toRun(run);
    }
    return toRun(await this.deps.lifecycle.transition(run, "canceled"));
  }

  async get(ctx: LocalContext, runId: string): Promise<Run> {
    return toRun(await this.deps.runs.get(ctx, runId));
  }

  async list(ctx: LocalContext, query: RunListQuery): Promise<Run[]> {
    return (await this.deps.runs.list(ctx, query)).map(toRun);
  }

  async events(
    ctx: LocalContext,
    runId: string,
    after: number,
    limit: number,
  ): Promise<RunEvent[]> {
    await this.deps.runs.get(ctx, runId);
    return this.deps.events.list(ctx.workspaceId, runId, after, limit);
  }

  /** Every waiting run with what its gate asked: the Inbox. */
  async pendingInterrupts(ctx: LocalContext): Promise<PendingInterrupt[]> {
    const waiting = await this.deps.runs.list(ctx, { status: "waiting", limit: 200 });
    return Promise.all(
      waiting.map(async (row) => {
        const graph = await this.deps.registry.graph(row.assistantId ?? "", row.targetVersion ?? 1);
        const state = await graph.getState(threadConfig(row.threadId));
        return { run: toRun(row), interrupts: await liveInterrupts(this.deps.checkpointer, state) };
      }),
    );
  }

  /**
   * Pins `version`, or the latest one. `latest` also checks the assistant
   * belongs to the workspace, and resolving the graph rejects unknown versions.
   */
  private async newThread(
    ctx: LocalContext,
    assistantId: string,
    version: number | undefined,
    tx: Tx,
  ) {
    const latest = await this.deps.registry.latest(assistantId, ctx.workspaceId);
    const assistantVersion = version ?? latest.version;
    await this.deps.registry.graph(assistantId, assistantVersion);
    return this.deps.threads.insert(ctx, { assistantId, assistantVersion }, tx);
  }

  private async head(assistantId: string, version: number, threadId: string) {
    const graph = await this.deps.registry.graph(assistantId, version);
    return checkpointIdOf((await graph.getState(threadConfig(threadId))).config);
  }

  private async enqueue(run: RunRow, payload: RunJobPayload, tx: Tx): Promise<void> {
    const job = { workspaceId: run.workspaceId, createdBy: run.createdBy, kind: RUN_JOB_KIND };
    await this.deps.queue.enqueue({ ...job, runId: run.id, payload }, tx);
  }

  private async queued(row: RunRow): Promise<Run> {
    const run = toRun(await this.deps.lifecycle.transition(row, "queued"));
    this.deps.worker.wake();
    return run;
  }
}
