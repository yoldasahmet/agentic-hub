import { describe, expect, it } from "vitest";
import { agentId, doc, edge, llmSpec, schema, text } from "../test/fixtures";
import { compileWorkflow, testDeps } from "../test/runtime";

const writer = agentId();
const agents = { [writer]: llmSpec() };
const gate = {
  kind: "gate" as const,
  id: "approve",
  title: "Ship it?",
  message: "Draft: {{input.draft}}",
  schema: schema(text("draft", true)),
  bindings: { draft: { kind: "node" as const, node: "write", field: "text" } },
};
const write = {
  kind: "agent" as const,
  id: "write",
  agentId: writer,
  bindings: { task: { kind: "input" as const, field: "task" } },
};
const publish = {
  kind: "agent" as const,
  id: "publish",
  agentId: writer,
  bindings: { task: { kind: "node" as const, node: "approve", field: "draft" } },
};

function gated(extra: Partial<typeof gate> & { onReject?: "stop" | "continue" } = {}) {
  return doc({
    nodes: [write, { ...gate, ...extra }, publish],
    edges: [
      edge("write", "approve"),
      edge("approve", "publish", { condition: { var: "nodes.approve.output.approved" } }),
    ],
  });
}

async function pendingGate(run: ReturnType<typeof compileWorkflow>) {
  const snapshot = await run.state();
  return snapshot.tasks.flatMap((t) => t.interrupts.map((i) => i.value));
}

describe("gates", () => {
  it("pauses with the bound data and continues with the reviewer's edits", async () => {
    const { deps, provider } = testDeps(["v1", "published"]);
    const run = compileWorkflow(gated(), agents, deps);
    await run.start({ task: "t" });
    expect(await pendingGate(run)).toEqual([
      expect.objectContaining({
        kind: "workflow.gate",
        node: "approve",
        title: "Ship it?",
        message: "Draft: v1",
        data: { draft: "v1" },
        issues: [],
      }),
    ]);
    const state = await run.resume({ action: "approve", data: { draft: "v2" }, comment: "nice" });
    expect(state.nodes.approve?.output).toEqual({ draft: "v2", approved: true, comment: "nice" });
    expect(provider.requests.at(-1)?.messages.at(-1)?.content).toBe("v2");
    expect(state.nodes.publish?.status).toBe("succeeded");
  });

  it("asks again when the edited data doesn't match the gate's fields", async () => {
    const { deps } = testDeps(["v1"]);
    const run = compileWorkflow(gated(), agents, deps);
    await run.start({ task: "t" });
    await run.resume({ action: "approve", data: { draft: 5 } });
    const [request] = await pendingGate(run);
    expect(request).toMatchObject({
      kind: "workflow.gate",
      issues: expect.arrayContaining([expect.any(String)]),
    });
  });

  it("fails the run on reject by default", async () => {
    const { deps } = testDeps(["v1"]);
    const run = compileWorkflow(gated(), agents, deps);
    await run.start({ task: "t" });
    await expect(run.resume({ action: "reject", comment: "no" })).rejects.toMatchObject({
      code: "workflow.rejected",
    });
  });

  it("records the rejection for conditions with onReject: continue", async () => {
    const { deps, provider } = testDeps(["v1"]);
    const run = compileWorkflow(gated({ onReject: "continue" }), agents, deps);
    await run.start({ task: "t" });
    const state = await run.resume({ action: "reject", comment: "later" });
    expect(state.nodes.approve).toMatchObject({
      status: "rejected",
      output: { draft: "v1", approved: false, comment: "later" },
    });
    expect(state.nodes.publish).toBeUndefined();
    expect(provider.requests).toHaveLength(1);
  });

  it("reviews an agent's input and output around the node", async () => {
    const { deps, provider } = testDeps(["drafted"]);
    const d = doc({ nodes: [{ ...write, reviewInput: true, reviewOutput: true }] });
    const run = compileWorkflow(d, agents, deps);
    await run.start({ task: "original" });
    expect(await pendingGate(run)).toEqual([expect.objectContaining({ node: "write" })]);
    await run.resume({ action: "approve", data: { task: "edited" } });
    expect(provider.requests[0]?.messages.at(-1)?.content).toBe("edited");
    expect(await pendingGate(run)).toHaveLength(1);
    const state = await run.resume({ action: "approve", data: { text: "polished" } });
    expect(state.nodes.write?.output).toEqual({ text: "polished" });
    expect(state.output).toEqual({ text: "polished" });
  });
});
