import { AppError } from "@agentic/contracts";
import { moduleLogger, withLogContext } from "@agentic/logger";
import type { JobQueue, JobRow } from "./job-queue";

const log = moduleLogger("graph.worker");

/** Why a job's signal was aborted. Handlers rethrow; the worker settles the job. */
export const abortReasons = {
  cancel: "cancel",
  shutdown: "shutdown",
  leaseLost: "lease-lost",
} as const;
export type AbortReason = (typeof abortReasons)[keyof typeof abortReasons];

export type JobHandler = (job: JobRow, signal: AbortSignal) => Promise<void>;

export type WorkerOptions = {
  owner: string;
  concurrency: number;
  pollMs: number;
  handlers: Record<string, JobHandler>;
  /** Runs before each claim: lease recovery and other periodic chores. */
  onTick?: () => Promise<void>;
  /** A job ran out of attempts on infrastructure errors. */
  onGiveUp?: (job: JobRow, error: AppError) => Promise<void>;
};

type Active = { job: JobRow; controller: AbortController; done: Promise<void> };

/**
 * Claims jobs up to a concurrency limit, renews their leases, and aborts a
 * job when its cancel flag is seen (any instance may set it) or its lease
 * is lost. On shutdown, jobs are handed back so the next start resumes them.
 */
export class Worker {
  private readonly active = new Map<string, Active>();
  private timer: NodeJS.Timeout | undefined;
  private ticking: Promise<void> | undefined;
  private stopped = true;
  private tickFailing = false;

  constructor(
    private readonly queue: JobQueue,
    private readonly options: WorkerOptions,
  ) {}

  start(): void {
    this.stopped = false;
    this.wake();
  }

  /** Claims immediately (after an enqueue) instead of waiting for the next poll. */
  wake(): void {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.ticking ??= this.tick().finally(() => {
      this.ticking = undefined;
      if (!this.stopped) this.timer = setTimeout(() => this.wake(), this.options.pollMs);
    });
  }

  /** Aborts a run held by this instance right away (others see the cancel flag). */
  cancelLocal(runId: string): void {
    for (const { job, controller } of this.active.values()) {
      if (job.runId === runId) controller.abort(abortReasons.cancel);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.ticking;
    for (const { controller } of this.active.values()) controller.abort(abortReasons.shutdown);
    await Promise.allSettled([...this.active.values()].map((a) => a.done));
  }

  private async tick(): Promise<void> {
    try {
      await this.options.onTick?.();
      const free = this.options.concurrency - this.active.size;
      const claimed = await this.queue.claim(this.options.owner, free);
      for (const job of claimed) this.run(job);
      if (this.tickFailing) log.info("job queue reachable again");
      this.tickFailing = false;
    } catch (err) {
      // The DB may be briefly unreachable; the next poll retries. Logged once per outage.
      if (!this.tickFailing) log.warn({ err }, "job queue poll failed");
      this.tickFailing = true;
    }
  }

  private run(job: JobRow): void {
    const controller = new AbortController();
    const heartbeat = setInterval(() => void this.beat(job, controller), this.queue.leaseMs / 3);
    const context = job.runId ? { runId: job.runId } : {};
    const done = withLogContext(context, () => this.execute(job, controller.signal)).finally(() => {
      clearInterval(heartbeat);
      this.active.delete(job.id);
      this.wake();
    });
    this.active.set(job.id, { job, controller, done });
  }

  private async execute(job: JobRow, signal: AbortSignal): Promise<void> {
    const { owner, handlers } = this.options;
    try {
      const handler = handlers[job.kind];
      if (!handler) throw new AppError("internal", `No handler for job kind ${job.kind}`);
      log.debug({ jobId: job.id, kind: job.kind, attempt: job.attempts }, "job started");
      await handler(job, signal);
      await this.queue.finish(job.id, owner, "done");
      log.debug({ jobId: job.id, kind: job.kind }, "job done");
    } catch (err) {
      await this.settleFailure(job, signal, err).catch((settleErr: unknown) =>
        log.error({ jobId: job.id, err: settleErr }, "could not settle a failed job"),
      );
    }
  }

  private async settleFailure(job: JobRow, signal: AbortSignal, err: unknown): Promise<void> {
    const { owner, onGiveUp } = this.options;
    if (signal.aborted && signal.reason === abortReasons.cancel) {
      return this.queue.finish(job.id, owner, "canceled");
    }
    if (signal.aborted && signal.reason === abortReasons.shutdown) {
      return this.queue.release(job.id, owner);
    }
    if (signal.aborted && signal.reason === abortReasons.leaseLost) {
      log.warn({ jobId: job.id, kind: job.kind }, "job lease lost");
      return;
    }
    const error = AppError.from(err);
    const gaveUp = await this.queue.fail(job, owner, error.message);
    const fields = { jobId: job.id, kind: job.kind, attempt: job.attempts, err };
    if (gaveUp) log.error(fields, "job failed, no attempts left");
    else log.warn(fields, "job failed, will retry");
    if (gaveUp) await onGiveUp?.(job, error);
  }

  private async beat(job: JobRow, controller: AbortController): Promise<void> {
    try {
      const status = await this.queue.heartbeat(job.id, this.options.owner);
      if (status === undefined) controller.abort(abortReasons.leaseLost);
      else if (status === "canceling") controller.abort(abortReasons.cancel);
    } catch {
      // Keep running; the lease covers a few missed beats.
    }
  }
}
