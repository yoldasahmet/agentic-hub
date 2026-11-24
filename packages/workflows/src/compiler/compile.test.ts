import type { Bindings } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { agentId, doc, edge, llmSpec, text } from "../test/fixtures";
import { compileWorkflow, testDeps } from "../test/runtime";

const planner = agentId();
const writer = agentId();
const agents = { [planner]: llmSpec([text("plan", true)]), [writer]: llmSpec() };
const fromInput = { task: { kind: "input" as const, field: "task" } };
const fromNode = (node: string, field: string | null = "text") => ({
  task: { kind: "node" as const, node, field },
});
const agent = (id: string, target: string, bindings: Bindings) => ({
  kind: "agent" as const,
  id,
  agentId: target,
  bindings,
});

describe("buildWorkflowGraph", () => {
  it("runs a pipeline: bindings feed each node, outputs map to the result", async () => {
    const { deps, provider } = testDeps(['{"plan":"step one"}', "wrote it"]);
    const d = doc({
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
      outputs: { result: { kind: "node", node: "write", field: "text" } },
      nodes: [agent("plan", planner, fromInput), agent("write", writer, fromNode("plan", "plan"))],
      edges: [edge("plan", "write")],
    });
    const run = compileWorkflow(d, agents, deps);
    const state = await run.start({ task: "build" });
    expect(provider.requests.map((r) => r.messages.at(-1)?.content)).toEqual(["build", "step one"]);
    expect(state.output).toEqual({ result: "wrote it" });
    expect(state.nodes.plan).toMatchObject({
      status: "succeeded",
      output: { plan: "step one" },
      runs: 1,
    });
  });

  it("follows only the edges whose condition holds", async () => {
    const { deps } = testDeps(["yes", "unused"]);
    const d = doc({
      nodes: [
        agent("short", writer, fromInput),
        agent("long", writer, fromInput),
        agent("first", writer, fromInput),
      ],
      edges: [
        edge("first", "short", { condition: { "<": [{ var: "input.size" }, 10] } }),
        edge("first", "long", { condition: { ">=": [{ var: "input.size" }, 10] } }),
      ],
    });
    const state = await compileWorkflow(d, agents, deps).start({ task: "t", size: "3" });
    expect(Object.keys(state.nodes).sort()).toEqual(["first", "short"]);
  });

  it("fans out in parallel and joins once all branches finish", async () => {
    const { deps, provider } = testDeps(["x"]);
    const d = doc({
      nodes: ["a", "b", "c", "d"].map((id) => agent(id, writer, fromInput)),
      edges: [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")],
    });
    const state = await compileWorkflow(d, agents, deps).start({ task: "t" });
    expect(provider.requests).toHaveLength(4);
    expect(state.nodes.d?.runs).toBe(1);
  });

  it("stops a loop edge after its max iterations", async () => {
    const { deps, provider } = testDeps(["again"]);
    const d = doc({
      nodes: [agent("draft", writer, fromInput), agent("check", writer, fromNode("draft"))],
      edges: [edge("draft", "check"), edge("check", "draft", { maxIterations: 2 })],
    });
    const state = await compileWorkflow(d, agents, deps).start({ task: "t" });
    expect(state.nodes.draft?.runs).toBe(3);
    expect(state.nodes.check?.runs).toBe(3);
    expect(provider.requests).toHaveLength(6);
  });

  it("skips disabled nodes but keeps the chain connected", async () => {
    const { deps } = testDeps(["x"]);
    const d = doc({
      nodes: [
        agent("a", writer, fromInput),
        { ...agent("b", writer, fromInput), enabled: false },
        agent("c", writer, fromInput),
      ],
      edges: [edge("a", "b"), edge("b", "c")],
    });
    const state = await compileWorkflow(d, agents, deps).start({ task: "t" });
    expect(Object.keys(state.nodes).sort()).toEqual(["a", "c"]);
  });

  it("retries a failing node with its retry policy", async () => {
    const failure = [{ type: "error" as const, message: "boom" }, { type: "done" as const }];
    const { deps, provider } = testDeps([failure, "ok"]);
    const d = doc({
      nodes: [{ ...agent("a", writer, fromInput), retry: { maxAttempts: 2, backoffMs: 0 } }],
    });
    const state = await compileWorkflow(d, agents, deps).start({ task: "t" });
    expect(provider.requests).toHaveLength(2);
    expect(state.nodes.a?.output).toEqual({ text: "ok" });
  });

  it("fails the run with the node's error when retries run out", async () => {
    const { deps } = testDeps([[{ type: "error", message: "boom" }, { type: "done" }]]);
    const d = doc({ nodes: [agent("a", writer, fromInput)] });
    await expect(compileWorkflow(d, agents, deps).start({ task: "t" })).rejects.toMatchObject({
      details: expect.objectContaining({ node: "a" }),
    });
  });
});
