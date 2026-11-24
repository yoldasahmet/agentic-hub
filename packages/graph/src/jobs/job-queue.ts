import { type Database, schema } from "@agentic/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { Executor } from "../lib/executor";

const { jobs } = schema;
export type JobRow = typeof jobs.$inferSelect;
/** Open set (text): queued → running → done | failed; canceling → canceled. */
export type JobStatus = "queued" | "running" | "canceling" | "done" | "failed" | "canceled";

export type NewJob = {
  workspaceId: string;
  createdBy: string;
  kind: string;
  runId?: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  maxAttempts?: number;
};

/**
 * The Postgres job queue (D11). A worker claims with `FOR UPDATE SKIP
 * LOCKED` and holds a lease it renews with heartbeats, so each job runs
 * once across every app instance sharing the DB, and a crashed holder's
 * jobs are reclaimed when the lease expires.
 */
export class JobQueue {
  constructor(
    private readonly db: Database,
    readonly leaseMs: number,
  ) {}

  async enqueue(job: NewJob, db: Executor = this.db): Promise<JobRow> {
    const [row] = await db.insert(jobs).values(job).returning();
    if (!row) throw new Error("Failed to enqueue the job");
    return row;
  }

  async claim(owner: string, limit: number): Promise<JobRow[]> {
    if (limit <= 0) return [];
    const result = await this.db.execute(sql`
      update jobs set status = 'running', lease_owner = ${owner},
        lease_expires_at = now() + make_interval(secs => ${this.leaseMs / 1000}),
        attempts = attempts + 1, updated_at = now()
      where id in (
        select id from jobs where status = 'queued' and run_after <= now()
        order by priority desc, run_after, id
        for update skip locked limit ${limit}
      )
      returning id`);
    const ids = result.rows.map((r) => String(r.id));
    if (ids.length === 0) return [];
    return this.db.select().from(jobs).where(inArray(jobs.id, ids));
  }

  /** Renews the lease. `undefined` means the lease was lost (expired and reclaimed). */
  async heartbeat(id: string, owner: string): Promise<JobStatus | undefined> {
    const [row] = await this.db
      .update(jobs)
      .set({ leaseExpiresAt: sql`now() + make_interval(secs => ${this.leaseMs / 1000})` })
      .where(and(eq(jobs.id, id), eq(jobs.leaseOwner, owner)))
      .returning({ status: jobs.status });
    return row ? toStatus(row.status) : undefined;
  }

  finish(id: string, owner: string, status: "done" | "canceled"): Promise<void> {
    return this.settle(id, owner, { status, leaseOwner: null, leaseExpiresAt: null });
  }

  /** Hands a job back after a clean shutdown, without spending an attempt. */
  release(id: string, owner: string): Promise<void> {
    return this.settle(id, owner, {
      status: "queued",
      attempts: sql`greatest(attempts - 1, 0)`,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  }

  /** Retries with exponential backoff until `max_attempts`; returns whether it gave up. */
  async fail(job: JobRow, owner: string, error: string): Promise<boolean> {
    const giveUp = job.attempts >= job.maxAttempts;
    const backoffMs = Math.min(2 ** job.attempts * 1000, 60_000);
    await this.settle(job.id, owner, {
      status: giveUp ? "failed" : "queued",
      lastError: error.slice(0, 2000),
      runAfter: new Date(Date.now() + backoffMs),
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    return giveUp;
  }

  /** Queued jobs cancel at once; running ones are flagged for their worker. */
  async requestCancel(runId: string): Promise<"canceled" | "canceling" | "none"> {
    const [row] = await this.db
      .update(jobs)
      .set({ status: sql`case when status = 'queued' then 'canceled' else 'canceling' end` })
      .where(and(eq(jobs.runId, runId), inArray(jobs.status, ["queued", "running"])))
      .returning({ status: jobs.status });
    if (!row) return "none";
    return row.status === "canceled" ? "canceled" : "canceling";
  }

  private async settle(id: string, owner: string, patch: PgUpdateSetSource<typeof jobs>) {
    await this.db
      .update(jobs)
      .set(patch)
      .where(and(eq(jobs.id, id), eq(jobs.leaseOwner, owner)));
  }
}

function toStatus(value: string): JobStatus {
  const known: JobStatus[] = ["queued", "running", "canceling", "done", "failed", "canceled"];
  return known.find((s) => s === value) ?? "failed";
}
