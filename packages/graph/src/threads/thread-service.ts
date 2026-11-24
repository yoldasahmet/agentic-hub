import {
  AppError,
  type Checkpoint,
  type ForkThreadInput,
  forkThreadInputSchema,
  type HistoryQuery,
  type Thread,
  type ThreadListQuery,
  type ThreadState,
  type UpdateStateInput,
} from "@agentic/contracts";
import type { Database, LocalContext } from "@agentic/db";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { AssistantRegistry } from "../assistants/registry";
import { lockThread } from "../lib/thread-lock";
import type { RunStore } from "../runs/run-store";
import { liveInterrupts, threadConfig, toCheckpoint } from "../state/checkpoint-mapper";
import { copyCheckpoint } from "../state/copy-checkpoint";
import type { ThreadStore } from "./thread-store";

export type ThreadServiceDeps = {
  db: Database;
  registry: AssistantRegistry;
  checkpointer: BaseCheckpointSaver;
  threads: ThreadStore;
  runs: RunStore;
  /** Re-queues a waiting run after its state was edited (RunService.continueWaiting). */
  continueWaiting: (runId: string) => Promise<void>;
};

/** Thread state from LangGraph checkpoints: read, history, edit (as a node), and fork. */
export class ThreadService {
  constructor(private readonly deps: ThreadServiceDeps) {}

  /** An empty thread pinned to the assistant's latest version; its first run starts it (chats). */
  async create(ctx: LocalContext, assistantId: string): Promise<Thread> {
    const { version } = await this.deps.registry.latest(assistantId, ctx.workspaceId);
    return this.deps.threads.insert(ctx, { assistantId, assistantVersion: version });
  }

  list(ctx: LocalContext, query: ThreadListQuery): Promise<Thread[]> {
    return this.deps.threads.list(ctx, query);
  }

  async state(ctx: LocalContext, threadId: string): Promise<ThreadState> {
    const thread = await this.deps.threads.get(ctx, threadId);
    const snapshot = await (await this.graphOf(thread)).getState(threadConfig(threadId));
    const interrupts = await liveInterrupts(this.deps.checkpointer, snapshot);
    return { thread, state: toCheckpoint(snapshot, interrupts) };
  }

  async history(ctx: LocalContext, threadId: string, query: HistoryQuery): Promise<Checkpoint[]> {
    const thread = await this.deps.threads.get(ctx, threadId);
    const before = query.before ? threadConfig(threadId, query.before) : undefined;
    const items: Checkpoint[] = [];
    const history = (await this.graphOf(thread)).getStateHistory(threadConfig(threadId), {
      limit: query.limit,
      before,
    });
    for await (const snapshot of history) {
      const interrupts = await liveInterrupts(this.deps.checkpointer, snapshot);
      const checkpoint = toCheckpoint(snapshot, interrupts);
      if (checkpoint) items.push(checkpoint);
    }
    return items;
  }

  /**
   * Writes values as `asNode` on top of a checkpoint. Not while a run is
   * executing; a waiting run continues from the edit (RunService.continueWaiting).
   */
  async updateState(
    ctx: LocalContext,
    threadId: string,
    input: UpdateStateInput,
  ): Promise<ThreadState> {
    const waiting = await this.deps.db.transaction(async (tx) => {
      const thread = await this.deps.threads.get(ctx, threadId, tx);
      await lockThread(tx, threadId);
      const active = await this.deps.runs.activeOnThread(threadId, tx);
      if (active && active.status !== "waiting") {
        throw new AppError(
          "conflict",
          `Run ${active.id} is ${active.status}; wait or cancel it first`,
        );
      }
      const config = threadConfig(threadId, input.checkpointId);
      await (await this.graphOf(thread)).updateState(config, input.values, input.asNode);
      return active;
    });
    if (waiting) await this.deps.continueWaiting(waiting.id);
    return this.state(ctx, threadId);
  }

  /** Copies a checkpoint into a new thread that keeps the same pinned assistant. */
  async fork(ctx: LocalContext, threadId: string, raw: ForkThreadInput): Promise<Thread> {
    const input = forkThreadInputSchema.parse(raw);
    const source = await this.deps.threads.get(ctx, threadId);
    const tuple = await this.deps.checkpointer.getTuple(threadConfig(threadId, input.checkpointId));
    if (!tuple) throw new AppError("not_found", `Checkpoint ${input.checkpointId} not found`);
    const thread = await this.deps.threads.insert(ctx, {
      assistantId: source.assistantId,
      assistantVersion: source.assistantVersion,
      forkedFrom: { threadId, checkpointId: input.checkpointId },
    });
    await copyCheckpoint(this.deps.checkpointer, tuple, thread.id, input.keepPendingWrites);
    const { state } = await this.state(ctx, thread.id);
    if (state?.interrupts.length) await this.deps.threads.setStatus(thread.id, "interrupted");
    return this.deps.threads.get(ctx, thread.id);
  }

  private graphOf(thread: Thread) {
    return this.deps.registry.graph(thread.assistantId, thread.assistantVersion);
  }
}
