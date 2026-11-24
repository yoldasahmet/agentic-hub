import { schema } from "@agentic/db";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { JobQueue } from "./job-queue";
import { recoverExpiredJobs, recoverOrphanedJobs } from "./job-recovery";

let db: TestDatabase;
let queue: JobQueue;
const job = (kind = "test.job", maxAttempts = 3) => ({
  workspaceId: db.workspaceId,
  createdBy: db.userId,
  kind,
  maxAttempts,
});

beforeAll(async () => {
  db = await createTestDatabase();
  queue = new JobQueue(db.handle.db, 30_000);
});
afterAll(() => db.drop());
beforeEach(async () => {
  await db.handle.db.delete(schema.jobs);
});

describe("JobQueue", () => {
  it("hands each job to exactly one of many concurrent claimers", async () => {
    for (let i = 0; i < 20; i++) await queue.enqueue(job());
    const claims = await Promise.all(
      Array.from({ length: 6 }, (_, i) => queue.claim(`host:${i}:x`, 5)),
    );
    const ids = claims.flat().map((j) => j.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(claims.flat().every((j) => j.status === "running" && j.attempts === 1)).toBe(true);
  });

  it("skips jobs scheduled for later", async () => {
    await queue.enqueue({ ...job(), runAfter: new Date(Date.now() + 60_000) });
    expect(await queue.claim("a", 5)).toEqual([]);
  });

  it("renews leases only for their holder", async () => {
    await queue.enqueue(job());
    const [claimed] = await queue.claim("a", 1);
    if (!claimed) throw new Error("no job");
    expect(await queue.heartbeat(claimed.id, "a")).toBe("running");
    expect(await queue.heartbeat(claimed.id, "b")).toBeUndefined();
    await queue.finish(claimed.id, "b", "done");
    const [row] = await db.handle.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, claimed.id));
    expect(row?.status).toBe("running");
    await queue.finish(claimed.id, "a", "done");
    const [done] = await db.handle.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, claimed.id));
    expect(done).toMatchObject({ status: "done", leaseOwner: null });
  });

  it("retries with backoff, then gives up after max attempts", async () => {
    await queue.enqueue(job("test.job", 2));
    const [first] = await queue.claim("a", 1);
    if (!first) throw new Error("no job");
    expect(await queue.fail(first, "a", "boom")).toBe(false);
    const [requeued] = await db.handle.db.select().from(schema.jobs);
    expect(requeued).toMatchObject({ status: "queued", lastError: "boom" });
    expect(requeued?.runAfter.getTime()).toBeGreaterThan(Date.now());

    await db.handle.db.update(schema.jobs).set({ runAfter: new Date(0) });
    const [second] = await queue.claim("a", 1);
    if (!second) throw new Error("no retry");
    expect(second.attempts).toBe(2);
    expect(await queue.fail(second, "a", "boom again")).toBe(true);
    const [failed] = await db.handle.db.select().from(schema.jobs);
    expect(failed?.status).toBe("failed");
  });

  it("releases without spending an attempt", async () => {
    await queue.enqueue(job());
    const [claimed] = await queue.claim("a", 1);
    if (!claimed) throw new Error("no job");
    await queue.release(claimed.id, "a");
    const [row] = await db.handle.db.select().from(schema.jobs);
    expect(row).toMatchObject({ status: "queued", attempts: 0, leaseOwner: null });
  });

  it("requeues expired leases and settles canceling and exhausted jobs", async () => {
    const [a, b, c] = await Promise.all([
      queue.enqueue(job("test.job", 3)),
      queue.enqueue(job("test.job", 3)),
      queue.enqueue(job("test.job", 1)),
    ]);
    await queue.claim("dead:1:x", 3);
    await db.handle.db.execute(sql`update jobs set status = 'canceling' where id = ${b?.id}`);
    await db.handle.db.execute(sql`update jobs set lease_expires_at = now() - interval '1 second'`);
    const recovered = await recoverExpiredJobs(db.handle.db);
    const status = Object.fromEntries(recovered.map((r) => [r.id, r.status]));
    expect(status).toEqual({
      [a?.id ?? ""]: "queued",
      [b?.id ?? ""]: "canceled",
      [c?.id ?? ""]: "failed",
    });
  });

  it("reclaims leases of a dead process on this host right away", async () => {
    await queue.enqueue(job());
    await queue.enqueue(job());
    const [mine] = await queue.claim("mac:111:x", 1);
    await queue.claim("mac:222:y", 1);
    const recovered = await recoverOrphanedJobs(db.handle.db, "mac", (pid) => pid === 222);
    expect(recovered).toEqual([{ id: mine?.id, runId: null, status: "queued" }]);
  });
});
