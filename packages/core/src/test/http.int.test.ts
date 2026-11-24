import { agentSchema, appErrorSchema, newId } from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db);
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
});

describe("Core HTTP boundary", () => {
  it("serves /health without a token and reports the database", async () => {
    const res = await fetch(`${core.core.info.url}/health`);
    expect(res.status).toBe(200);
    expect(core.core.db.migrationsApplied).toBeGreaterThan(0);
  });

  it("rejects missing and wrong tokens", async () => {
    const none = await fetch(`${core.core.info.url}/agents`);
    expect(none.status).toBe(401);
    const wrong = await core.request("GET", "/agents", undefined, "x".repeat(64));
    expect(wrong.status).toBe(401);
    expect(appErrorSchema.parse(await wrong.json()).code).toBe("unauthorized");
  });

  it("validates input with the contract schemas", async () => {
    const res = await core.request("POST", "/agents", { name: "" });
    expect(res.status).toBe(400);
    expect(appErrorSchema.parse(await res.json()).code).toBe("validation_failed");
  });

  it("answers unknown ids with not_found and a trace id", async () => {
    const res = await core.request("GET", `/agents/${newId()}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("x-trace-id")).toBeTruthy();
  });

  it("lists what it created", async () => {
    await core.api(agentSchema, "POST", "/agents", { name: "Listed" });
    const list = await core.api(z.array(agentSchema), "GET", "/agents");
    expect(list.map((a) => a.name)).toContain("Listed");
  });
});
