import type { RunEvent } from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GraphRuntime } from "../runtime";
import { testRuntime } from "../test/runtime";

let db: TestDatabase;
let graph: GraphRuntime;

beforeAll(async () => {
  db = await createTestDatabase();
  graph = await testRuntime(db);
});
afterAll(async () => {
  await graph.stop();
  await db.drop();
});

const statuses = (events: RunEvent[]) =>
  events.flatMap((e) => (e.type === "run.status" ? [e.payload.status] : []));

describe("runs on the embedded LangGraph host", () => {
  it("runs to a gate, persists every event, and resumes the same run", async () => {
    const live: RunEvent[] = [];
    const unsubscribe = graph.bus.subscribe((m) => {
      if (m.kind === "event") live.push(m.event);
    });
    const run = await graph.runs.create(db, { assistantId: "sample", input: { topic: "tests" } });
    const waiting = await graph.waitForRun(db, run.id, 15_000);
    expect(waiting.status).toBe("waiting");

    const inbox = await graph.runs.pendingInterrupts(db);
    expect(inbox.map((p) => p.run.id)).toContain(run.id);

    const resumed = await graph.runs.resume(db, run.id, { approved: true, note: "ok" });
    expect(resumed.id).toBe(run.id);
    const done = await graph.waitForRun(db, run.id, 15_000);
    expect(done.status).toBe("succeeded");
    expect(done.output).toMatchObject({ result: "Approved: A short note about tests. (ok)" });
    unsubscribe();

    const events = await graph.runs.events(db, run.id, 0, 1000);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(statuses(events)).toEqual([
      "queued",
      "running",
      "waiting",
      "queued",
      "running",
      "succeeded",
    ]);
    expect(events.some((e) => e.type === "run.interrupted")).toBe(true);
    expect(events.some((e) => e.type === "custom")).toBe(true);
    // Persisted before broadcast: everything seen live is in the log, in order.
    const ownLive = live.filter((e) => e.runId === run.id);
    expect(ownLive.map((e) => e.seq)).toEqual(events.map((e) => e.seq));
  });

  it("replays from a cursor without gaps or duplicates", async () => {
    const run = await graph.runs.create(db, { assistantId: "sample", input: { topic: "replay" } });
    await graph.waitForRun(db, run.id, 15_000);
    const all = await graph.runs.events(db, run.id, 0, 1000);
    const pages: RunEvent[] = [];
    let after = 0;
    for (;;) {
      const page = await graph.runs.events(db, run.id, after, 2);
      if (page.length === 0) break;
      pages.push(...page);
      after = page.at(-1)?.seq ?? after;
    }
    expect(pages).toEqual(all);
    expect(await graph.runs.events(db, run.id, all.length, 10)).toEqual([]);
  });

  it("allows one active run per thread", async () => {
    const run = await graph.runs.create(db, { assistantId: "sample", input: { topic: "x" } });
    await expect(
      graph.runs.create(db, { assistantId: "sample", threadId: run.threadId, input: {} }),
    ).rejects.toMatchObject({ code: "conflict" });
    await graph.waitForRun(db, run.id, 15_000);
    await expect(graph.runs.resume(db, run.id, "not an answer")).resolves.toBeDefined();
    const failed = await graph.waitForRun(db, run.id, 15_000);
    expect(failed.status).toBe("failed");
  });

  it("cancels a running run", async () => {
    const run = await graph.runs.create(db, {
      assistantId: "sample",
      input: { topic: "slow", delayMs: 30_000 },
    });
    await waitFor(async () => (await graph.runs.get(db, run.id)).status === "running");
    await graph.runs.cancel(db, run.id);
    const canceled = await graph.waitForRun(db, run.id, 15_000);
    expect(canceled.status).toBe("canceled");
  });

  it("keeps state across threads: state, history, and fork", async () => {
    const run = await graph.runs.create(db, { assistantId: "sample", input: { topic: "fork" } });
    await graph.waitForRun(db, run.id, 15_000);
    const { state } = await graph.threads.state(db, run.threadId);
    expect(state?.values).toMatchObject({ draft: "A short note about fork." });
    expect(state?.interrupts).toHaveLength(1);
    const history = await graph.threads.history(db, run.threadId, { limit: 10 });
    expect(history.length).toBeGreaterThan(1);
    const fork = await graph.threads.fork(db, run.threadId, {
      checkpointId: state?.checkpointId ?? "",
    });
    expect(fork.id).not.toBe(run.threadId);
    const forked = await graph.threads.state(db, fork.id);
    expect(forked.state?.values).toMatchObject({ draft: "A short note about fork." });
  });

  it("scopes runs by workspace", async () => {
    const run = await graph.runs.create(db, { assistantId: "sample", input: { topic: "x" } });
    const other = { workspaceId: crypto.randomUUID(), userId: db.userId };
    await expect(graph.runs.get(other, run.id)).rejects.toMatchObject({ code: "not_found" });
    await graph.waitForRun(db, run.id, 15_000);
  });
});

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting");
}
