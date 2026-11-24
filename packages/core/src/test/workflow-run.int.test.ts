import {
  agentSchema,
  agentVersionSchema,
  appErrorSchema,
  fieldsToSchema,
  pendingInterruptSchema,
  runEventPageSchema,
  runSchema,
  savedWorkflowSchema,
  workflowSchema,
  workflowVersionSchema,
} from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db, { replies: ['{"title":"Fix login"}', "Shipped: Fix login"] });
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
});

const text = (name: string, required = false) => ({
  name,
  type: "text" as const,
  description: "",
  required,
});

function llmSpec(outputs: ReturnType<typeof text>[]) {
  return {
    kind: "llm",
    inputSchema: fieldsToSchema([text("task", true)]),
    outputSchema: fieldsToSchema(outputs),
    prompt: { system: "", template: "{{input.task}}" },
    runtime: { model: { providerId: "fake", model: "fake-1" }, maxRepairs: 0 },
  };
}

async function publishedAgent(name: string, outputs: ReturnType<typeof text>[]) {
  const agent = await core.api(agentSchema, "POST", "/agents", { name, spec: llmSpec(outputs) });
  await core.api(agentVersionSchema, "POST", `/agents/${agent.id}/publish`, {
    revision: agent.revision,
  });
  return agent;
}

describe("agent → workflow → run → gate → result through Core", () => {
  it("runs a published workflow, waits at its gate, and finishes on approval", async () => {
    const planner = await publishedAgent("Planner", [text("title", true)]);
    const shipper = await publishedAgent("Shipper", []);
    const created = await core.api(workflowSchema, "POST", "/workflows", { name: "Ship" });
    const document = {
      inputSchema: fieldsToSchema([text("task", true)]),
      outputSchema: fieldsToSchema([text("result")]),
      outputs: { result: { kind: "node", node: "ship", field: "text" } },
      nodes: [
        {
          kind: "agent",
          id: "plan",
          agentId: planner.id,
          bindings: { task: { kind: "input", field: "task" } },
        },
        {
          kind: "gate",
          id: "approve",
          schema: fieldsToSchema([text("title", true)]),
          bindings: { title: { kind: "node", node: "plan", field: "title" } },
        },
        {
          kind: "agent",
          id: "ship",
          agentId: shipper.id,
          bindings: { task: { kind: "node", node: "approve", field: "title" } },
        },
      ],
      edges: [
        { id: "e1", from: "plan", to: "approve" },
        { id: "e2", from: "approve", to: "ship" },
      ],
    };
    const saved = await core.api(savedWorkflowSchema, "PATCH", `/workflows/${created.id}`, {
      revision: created.revision,
      draft: document,
    });
    expect(saved.issues).toEqual([]);
    const version = await core.api(
      workflowVersionSchema,
      "POST",
      `/workflows/${created.id}/publish`,
      {
        revision: saved.revision,
      },
    );
    expect(version.document.nodes.find((n) => n.id === "plan")).toMatchObject({ version: 1 });

    const run = await core.api(runSchema, "POST", `/workflows/${created.id}/runs`, {
      version: version.version,
      input: { task: "login is broken" },
    });
    const waiting = await core.api(runSchema, "GET", `/runs/${run.id}/wait?timeoutMs=20000`);
    expect(waiting.status).toBe("waiting");

    const inbox = await core.api(z.array(pendingInterruptSchema), "GET", "/inbox/interrupts");
    const gate = inbox.find((p) => p.run.id === run.id);
    expect(gate?.interrupts[0]?.value).toMatchObject({
      kind: "workflow.gate",
      data: { title: "Fix login" },
    });

    await core.api(runSchema, "POST", `/runs/${run.id}/resume`, {
      resume: { action: "approve", comment: "go" },
    });
    const done = await core.api(runSchema, "GET", `/runs/${run.id}/wait?timeoutMs=20000`);
    expect(done.status).toBe("succeeded");
    expect(done.output).toMatchObject({ output: { result: "Shipped: Fix login" } });
    expect(core.provider.requests.map((r) => r.messages.at(-1)?.content)).toEqual([
      "login is broken",
      "Fix login",
    ]);

    const page = await core.api(runEventPageSchema, "GET", `/runs/${run.id}/events?after=0`);
    expect(page.items.map((e) => e.seq)).toEqual(page.items.map((_, i) => i + 1));
    expect(page.lastSeq).toBe(page.items.length);
  });

  it("refuses to publish a workflow with blocking issues", async () => {
    const wf = await core.api(workflowSchema, "POST", "/workflows", { name: "Empty" });
    const res = await core.request("POST", `/workflows/${wf.id}/publish`, {
      revision: wf.revision,
    });
    expect(res.ok).toBe(false);
    expect(appErrorSchema.parse(await res.json()).code).toBeTruthy();
  });

  it("guards drafts with an optimistic revision", async () => {
    const agent = await core.api(agentSchema, "POST", "/agents", { name: "Rev" });
    await core.api(agentSchema, "PATCH", `/agents/${agent.id}`, {
      revision: agent.revision,
      name: "A",
    });
    const stale = await core.request("PATCH", `/agents/${agent.id}`, {
      revision: agent.revision,
      name: "B",
    });
    expect(stale.status).toBe(409);
  });
});
