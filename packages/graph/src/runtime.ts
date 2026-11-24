import { randomBytes } from "node:crypto";
import type { Run } from "@agentic/contracts";
import type { DbHandle, LocalContext } from "@agentic/db";
import { moduleLogger } from "@agentic/logger";
import type pg from "pg";
import type { AssistantRegistry } from "./assistants/registry";
import { type EventBus, InMemoryEventBus } from "./events/event-bus";
import { EventLog } from "./events/event-log";
import { JobQueue, type JobRow, type NewJob } from "./jobs/job-queue";
import { type JobHandler, Worker } from "./jobs/worker";
import type { Executor } from "./lib/executor";
import { createRunJobHandler } from "./runs/execute-run";
import { createRecovery } from "./runs/recover-runs";
import { RUN_JOB_KIND } from "./runs/run-job";
import { RunLifecycle } from "./runs/run-lifecycle";
import { RunService } from "./runs/run-service";
import { RunStore } from "./runs/run-store";
import { waitForRun } from "./runs/wait-for-run";
import { openGraphStorage } from "./storage/graph-storage";
import { ThreadService } from "./threads/thread-service";
import { ThreadStore } from "./threads/thread-store";

const log = moduleLogger("graph");

export type GraphRuntimeOptions = {
  handle: DbHandle;
  /** Connection options for the store's own pool (see graph-storage.ts). */
  connection: pg.PoolConfig;
  registry: AssistantRegistry;
  /** Identifies this process in job leases: `<host>:<pid>:<random>`. */
  host: string;
  concurrency?: number;
  leaseMs?: number;
  pollMs?: number;
};

/** Lets modules (triggers today, integrations later) run their own leased jobs. */
export type JobHost = {
  enqueue(job: NewJob, db?: Executor): Promise<JobRow>;
  handle(kind: string, handler: JobHandler): void;
  /** Runs before each claim, like lease recovery: cheap checks for due work. */
  onTick(task: () => Promise<void>): void;
};

export type GraphRuntime = {
  registry: AssistantRegistry;
  jobs: JobHost;
  runs: RunService;
  threads: ThreadService;
  bus: EventBus;
  waitForRun(ctx: LocalContext, runId: string, timeoutMs: number): Promise<Run>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

/** Composes the LangGraph host: storage, registry, event pipeline, job queue, and services. */
export async function createGraphRuntime(options: GraphRuntimeOptions): Promise<GraphRuntime> {
  const { handle, registry, host } = options;
  const { db } = handle;
  const storage = await openGraphStorage(handle.pool, options.connection);
  registry.attach(storage);

  const bus = new InMemoryEventBus();
  const events = new EventLog(db, bus);
  const runStore = new RunStore(db);
  const threadStore = new ThreadStore(db);
  const lifecycle = new RunLifecycle(runStore, threadStore, events, bus);
  const queue = new JobQueue(db, options.leaseMs ?? 30_000);
  const owner = `${host}:${process.pid}:${randomBytes(4).toString("hex")}`;
  const recovery = createRecovery({ db, runs: runStore, lifecycle, host, leaseMs: queue.leaseMs });
  const handlers: Record<string, JobHandler> = {
    [RUN_JOB_KIND]: createRunJobHandler({
      registry,
      checkpointer: storage.checkpointer,
      runs: runStore,
      events,
      lifecycle,
    }),
  };
  const ticks: Array<() => Promise<void>> = [recovery.sweep];
  const worker = new Worker(queue, {
    owner,
    concurrency: options.concurrency ?? 4,
    pollMs: options.pollMs ?? 1000,
    handlers,
    onTick: async () => {
      for (const tick of ticks) {
        await tick().catch((err: unknown) => log.warn({ err }, "periodic job task failed"));
      }
    },
    onGiveUp: recovery.giveUp,
  });
  const deps = { db, registry, runs: runStore, threads: threadStore };
  const runs = new RunService({
    ...deps,
    checkpointer: storage.checkpointer,
    queue,
    worker,
    events,
    lifecycle,
  });
  const threads = new ThreadService({
    ...deps,
    checkpointer: storage.checkpointer,
    continueWaiting: (runId) => runs.continueWaiting(runId),
  });

  const jobs: JobHost = {
    enqueue: async (job, db) => {
      const row = await queue.enqueue(job, db);
      worker.wake();
      return row;
    },
    handle: (kind, handler) => {
      handlers[kind] = handler;
    },
    onTick: (task) => {
      ticks.push(task);
    },
  };

  return {
    registry,
    jobs,
    runs,
    threads,
    bus,
    waitForRun: (ctx, runId, timeoutMs) =>
      waitForRun(bus, runId, () => runs.get(ctx, runId), timeoutMs),
    async start() {
      await recovery.reclaimOrphans();
      worker.start();
      log.info({ owner, concurrency: options.concurrency ?? 4 }, "job worker started");
    },
    async stop() {
      await worker.stop();
      await storage.close();
    },
  };
}
