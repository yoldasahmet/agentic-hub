import { schema } from "@agentic/db";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testRuntime } from "../test/runtime";

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(() => db.drop());

describe("run recovery", () => {
  it("hands a run back on shutdown and another instance finishes it", async () => {
    const first = await testRuntime(db);
    const run = await first.runs.create(db, {
      assistantId: "sample",
      input: { topic: "restart", delayMs: 2_000 },
    });
    await until(async () => (await first.runs.get(db, run.id)).status === "running");
    await first.stop();

    const [job] = await db.handle.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.runId, run.id));
    expect(job).toMatchObject({ status: "queued", attempts: 0, leaseOwner: null });

    const second = await testRuntime(db);
    try {
      const waiting = await second.waitForRun(db, run.id, 15_000);
      expect(waiting.status).toBe("waiting");
    } finally {
      await second.stop();
    }
  });

  it("requeues a run whose holder stopped heartbeating", async () => {
    const runtime = await testRuntime(db, { leaseMs: 1_000 });
    try {
      const run = await runtime.runs.create(db, {
        assistantId: "sample",
        input: { topic: "lease" },
      });
      await runtime.waitForRun(db, run.id, 15_000);
      // A crashed holder: a running job with an expired lease owned by nobody alive.
      await db.handle.db
        .update(schema.jobs)
        .set({ status: "running", leaseOwner: "gone:1:x", leaseExpiresAt: new Date(0) })
        .where(eq(schema.jobs.runId, run.id));
      await until(async () => {
        const [job] = await db.handle.db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.runId, run.id));
        return job?.leaseOwner !== "gone:1:x";
      });
    } finally {
      await runtime.stop();
    }
  });
});

async function until(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting");
}
