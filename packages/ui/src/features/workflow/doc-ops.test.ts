import { fieldsToSchema, workflowDocumentSchema } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { connect, nodeIdFrom, removeEdges, removeNodes, renameNode } from "./doc-ops";

const agentId = "0199a3b0-0000-7000-8000-000000000001";
const doc = workflowDocumentSchema.parse({
  inputSchema: fieldsToSchema([]),
  outputSchema: fieldsToSchema([]),
  outputs: { result: { kind: "node", node: "b", field: "text" } },
  nodes: [
    { kind: "agent", id: "a", agentId },
    {
      kind: "agent",
      id: "b",
      agentId,
      bindings: {
        task: { kind: "node", node: "a", field: "text" },
        keep: { kind: "input", field: "task" },
      },
    },
  ],
  edges: [{ id: "e1", from: "a", to: "b" }],
});

describe("canvas edit operations", () => {
  it("removes nodes with their edges and the bindings that read them", () => {
    const next = removeNodes(doc, ["a"]);
    expect(next.nodes.map((n) => n.id)).toEqual(["b"]);
    expect(next.edges).toEqual([]);
    expect(Object.keys(next.nodes[0]?.bindings ?? {})).toEqual(["keep"]);
    expect(removeNodes(doc, ["b"]).outputs).toEqual({});
  });

  it("connects a pair once with the next free edge id", () => {
    const once = connect(doc, "b", "a");
    expect(once.edges.at(-1)).toMatchObject({ id: "e2", from: "b", to: "a", condition: null });
    expect(connect(once, "b", "a")).toBe(once);
    expect(removeEdges(once, ["e1"]).edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("renames a node everywhere it is referenced", () => {
    const next = renameNode(doc, "a", "plan");
    expect(next.edges[0]).toMatchObject({ from: "plan", to: "b" });
    expect(next.nodes[1]?.bindings.task).toMatchObject({ node: "plan" });
  });

  it("derives node ids from names", () => {
    expect(nodeIdFrom("PR Summarizer", [])).toBe("pr_summarizer");
    expect(nodeIdFrom("PR Summarizer", ["pr_summarizer"])).toBe("pr_summarizer_2");
    expect(nodeIdFrom("123", [])).toBe("node");
  });
});
