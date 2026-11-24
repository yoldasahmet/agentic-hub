import {
  fieldsToSchema,
  type WorkflowDocument,
  type WorkflowNode,
  workflowDocumentSchema,
} from "@agentic/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeTarget, TargetLookup } from "../types";
import { toFlowEdges } from "./to-flow";
import { WorkflowCanvas } from "./workflow-canvas";

const agentId = "0199a3b0-0000-7000-8000-000000000001";
const doc: WorkflowDocument = workflowDocumentSchema.parse({
  inputSchema: fieldsToSchema([]),
  outputSchema: fieldsToSchema([]),
  nodes: [
    { kind: "agent", id: "plan", agentId, version: 2, position: { x: 0, y: 0 } },
    { kind: "gate", id: "approve", title: "Ship it?", position: { x: 300, y: 0 } },
    { kind: "agent", id: "retry", agentId, enabled: false, position: { x: 600, y: 0 } },
  ],
  edges: [
    { id: "e1", from: "plan", to: "approve" },
    { id: "e2", from: "approve", to: "plan", maxIterations: 2, condition: { var: "x" } },
  ],
});

const target: NodeTarget = {
  entity: { name: "Planner", color: "blue", icon: "bot" },
  inputSchema: fieldsToSchema([]),
  outputSchema: fieldsToSchema([]),
  versions: [2, 1],
  latestVersion: 2,
};
const lookup: TargetLookup = (node: WorkflowNode) => (node.kind === "agent" ? target : undefined);

function renderCanvas(props: Partial<Parameters<typeof WorkflowCanvas>[0]> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <div style={{ width: 1000, height: 600 }}>
      <WorkflowCanvas
        document={doc}
        lookup={lookup}
        selection={null}
        onSelect={onSelect}
        {...props}
      />
    </div>,
  );
  return { onSelect, ...view };
}

describe("WorkflowCanvas", () => {
  it("draws each node with its entity name, version, and gate title", () => {
    renderCanvas();
    expect(screen.getAllByText("Planner")).toHaveLength(2);
    expect(screen.getByText("Ship it?")).toBeTruthy();
    expect(screen.getByText("plan · v2")).toBeTruthy();
    expect(screen.getByText("retry · latest")).toBeTruthy();
  });

  it("selects a node on click and clears on the pane", () => {
    const { onSelect, container } = renderCanvas();
    fireEvent.click(screen.getByText("Ship it?"));
    expect(onSelect).toHaveBeenLastCalledWith({ kind: "node", id: "approve" });
    const pane = container.querySelector(".react-flow__pane");
    if (!pane) throw new Error("no pane");
    fireEvent.click(pane);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("shows live statuses on nodes", () => {
    renderCanvas({ statuses: { plan: "succeeded", approve: "waiting" } });
    expect(screen.getByText("approve · Needs input")).toBeTruthy();
    expect(screen.getByText("plan · v2 · Done")).toBeTruthy();
  });
});

describe("toFlowEdges", () => {
  it("marks loop edges, labels conditions, and highlights followed and invalid edges", () => {
    const issues = [
      { code: "unbounded_cycle" as const, severity: "error" as const, message: "", edge: "e1" },
    ];
    const edges = toFlowEdges(doc, null, issues, new Set(["e2"]));
    expect(edges.map((e) => [e.id, e.type])).toEqual([
      ["e1", "default"],
      ["e2", "smoothstep"],
    ]);
    expect(JSON.stringify(edges[0]?.style)).toContain("var(--danger)");
    expect(JSON.stringify(edges[1]?.style)).toContain("var(--accent)");
    expect(edges[1]?.label).toBeTruthy();
  });
});
