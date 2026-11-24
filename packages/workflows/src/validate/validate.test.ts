import { describe, expect, it } from "vitest";
import { catalogKey, catalogRefs } from "../catalog";
import { agentId, catalog, doc, edge, llmSpec, schema, text } from "../test/fixtures";
import { validateWorkflow } from "./index";

const planner = agentId();
const coder = agentId();
const specs = {
  [planner]: llmSpec([text("plan", true), { ...text("score"), type: "number" }]),
  [coder]: llmSpec([], [text("task", true), { ...text("count"), type: "integer" }]),
};
const agent = (id: string, agent: string, bindings = {}) => ({
  kind: "agent" as const,
  id,
  agentId: agent,
  bindings,
});
const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe("validateWorkflow", () => {
  it("passes a well-formed pipeline", () => {
    const d = doc({
      outputSchema: schema(text("result")),
      outputs: { result: { kind: "node", node: "code", field: "text" } },
      nodes: [
        agent("plan", planner, { task: { kind: "input", field: "task" } }),
        agent("code", coder, { task: { kind: "node", node: "plan", field: "plan" } }),
      ],
      edges: [edge("plan", "code")],
    });
    expect(validateWorkflow(d, catalog(specs))).toEqual([]);
  });

  it("reports an empty canvas", () => {
    expect(codes(validateWorkflow(doc(), catalog(specs)))).toEqual(["empty_workflow"]);
  });

  it("checks structure: ids, edges, cycles, orphans", () => {
    const d = doc({
      nodes: [
        { kind: "gate", id: "a" },
        { kind: "gate", id: "a" },
        { kind: "gate", id: "b" },
        { kind: "gate", id: "c" },
      ],
      edges: [edge("a", "b"), edge("b", "a"), edge("b", "zz")],
    });
    expect(codes(validateWorkflow(d, catalog(specs)))).toEqual([
      "duplicate_node_id",
      "orphaned_node",
      "unbounded_cycle",
      "unbounded_cycle",
      "unknown_edge_node",
    ]);
  });

  it("needs somewhere to start and end", () => {
    const d = doc({
      nodes: [
        { kind: "gate", id: "a" },
        { kind: "gate", id: "b" },
      ],
      edges: [edge("a", "b"), edge("b", "a")],
    });
    expect(codes(validateWorkflow(d, catalog(specs)))).toEqual([
      "no_entry_or_exit",
      "unbounded_cycle",
      "unbounded_cycle",
    ]);
  });

  it("checks targets: missing, unknown version, unpublished, subworkflow cycle", () => {
    const missing = agentId();
    const sub = agentId();
    const self = agentId();
    const cat = catalog(specs, {
      [catalogKey(planner, 9)]: { status: "unknown_version" },
    });
    cat.agents.set(catalogKey(coder, "latest"), {
      status: "ok",
      entry: { name: "Coder", inputSchema: schema(), outputSchema: schema(), published: false },
    });
    cat.workflows.set(catalogKey(sub, "latest"), {
      status: "ok",
      entry: {
        name: "Sub",
        inputSchema: schema(),
        outputSchema: schema(),
        published: true,
        reaches: [sub, self],
      },
    });
    const d = doc({
      nodes: [
        agent("a", missing),
        { ...agent("b", planner, { task: { kind: "input", field: "task" } }), version: 9 },
        agent("c", coder),
        { kind: "workflow", id: "d", workflowId: sub },
      ],
      edges: [edge("a", "b"), edge("b", "c"), edge("c", "d")],
    });
    expect(codes(validateWorkflow(d, cat, self))).toEqual([
      "agent_unpublished",
      "subworkflow_cycle",
      "unknown_agent",
      "unknown_version",
    ]);
  });

  it("checks bindings: fields, sources, order, types, required inputs", () => {
    const d = doc({
      nodes: [
        agent("plan", planner, {
          task: { kind: "input", field: "nope" },
          extra: { kind: "literal", value: 1 },
        }),
        agent("code", coder, {
          task: { kind: "node", node: "ghost", field: "x" },
          count: { kind: "node", node: "plan", field: "score" },
        }),
        agent("late", coder, {
          task: { kind: "node", node: "plan", field: "missing" },
        }),
        agent("first", coder, { task: { kind: "node", node: "late", field: "text" } }),
      ],
      edges: [edge("plan", "code"), edge("code", "late"), edge("first", "plan")],
    });
    const issues = validateWorkflow(d, catalog(specs));
    expect(codes(issues)).toEqual([
      "binding_not_upstream",
      "binding_type_mismatch",
      "unknown_input_field",
      "unknown_input_field",
      "unknown_node_reference",
      "unknown_output_field",
    ]);
    expect(issues.find((i) => i.code === "binding_type_mismatch")).toMatchObject({
      severity: "warning",
      node: "code",
      field: "count",
    });
  });

  it("requires fallbacks for disabled sources and unbound required inputs", () => {
    const d = doc({
      nodes: [
        { ...agent("plan", planner, { task: { kind: "input", field: "task" } }), enabled: false },
        agent("code", coder, { task: { kind: "node", node: "plan", field: "plan" } }),
        agent("again", coder, {
          task: {
            kind: "node",
            node: "plan",
            field: "plan",
            fallback: { kind: "input", field: "task" },
          },
        }),
        agent("bare", coder),
      ],
      edges: [edge("plan", "code"), edge("code", "again"), edge("again", "bare")],
    });
    expect(codes(validateWorkflow(d, catalog(specs)))).toEqual([
      "dangling_binding",
      "unbound_required_field",
    ]);
  });

  it("checks the output mapping", () => {
    const d = doc({
      outputSchema: schema(text("result")),
      outputs: {
        result: { kind: "node", node: "plan", field: "plan" },
        other: { kind: "input", field: "task" },
      },
      nodes: [agent("plan", planner, { task: { kind: "input", field: "task" } })],
    });
    expect(codes(validateWorkflow(d, catalog(specs)))).toEqual(["unknown_output_binding"]);
  });

  it("collects the refs a document needs", () => {
    const sub = agentId();
    const nodes = doc({
      nodes: [
        agent("a", planner),
        agent("b", planner),
        { kind: "workflow", id: "c", workflowId: sub },
      ],
    }).nodes;
    expect(catalogRefs(nodes)).toEqual({
      agents: [{ id: planner, pin: "latest" }],
      workflows: [{ id: sub, pin: "latest" }],
    });
  });
});
