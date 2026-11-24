import { describe, expect, it } from "vitest";
import { doc, edge } from "./test/fixtures";
import { ancestors, topology, unboundedCycleEdges } from "./topology";

const gate = (id: string, enabled = true) => ({ kind: "gate" as const, id, enabled });

describe("topology", () => {
  it("finds entries and exits, ignoring loop edges", () => {
    const d = doc({
      nodes: [gate("a"), gate("b"), gate("c")],
      edges: [edge("a", "b"), edge("b", "c"), edge("c", "b", { maxIterations: 3 })],
    });
    const topo = topology(d);
    expect(topo.entries).toEqual(["a"]);
    expect(topo.exits).toEqual(["c"]);
    expect(topo.outgoing("b").map((e) => e.to)).toEqual(["c"]);
  });

  it("bridges over disabled nodes along unconditional edges", () => {
    const d = doc({
      nodes: [gate("a"), gate("b", false), gate("c")],
      edges: [edge("a", "b"), edge("b", "c")],
    });
    const topo = topology(d);
    expect(topo.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(topo.edges).toEqual([expect.objectContaining({ id: "a-b>c", from: "a", to: "c" })]);
  });

  it("does not bridge a disabled node's conditional edges", () => {
    const d = doc({
      nodes: [gate("a"), gate("b", false), gate("c")],
      edges: [edge("a", "b"), edge("b", "c", { condition: { var: "x" } })],
    });
    expect(topology(d).edges).toEqual([]);
  });

  it("lists ancestors through loops and drops edges to unknown nodes", () => {
    const d = doc({
      nodes: [gate("a"), gate("b"), gate("c")],
      edges: [edge("a", "b"), edge("b", "c"), edge("c", "b", { maxIterations: 2 }), edge("x", "a")],
    });
    expect([...ancestors(d, "c")].sort()).toEqual(["a", "b", "x"]);
    expect([...ancestors(d, "b")].sort()).toEqual(["a", "c", "x"]);
    expect(topology(d).edges.some((e) => e.from === "x")).toBe(false);
  });

  it("flags only cycles without a loop edge", () => {
    const bounded = [edge("a", "b"), edge("b", "a", { maxIterations: 2 })];
    const unbounded = [edge("a", "b"), edge("b", "a")];
    const parse = (edges: ReturnType<typeof edge>[]) =>
      doc({ nodes: [gate("a"), gate("b")], edges }).edges;
    expect(unboundedCycleEdges(parse(bounded))).toEqual([]);
    expect(unboundedCycleEdges(parse(unbounded)).map((e) => e.id)).toEqual(["a-b", "b-a"]);
  });
});
