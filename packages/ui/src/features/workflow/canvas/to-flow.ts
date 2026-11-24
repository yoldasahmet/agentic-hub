import type { WorkflowDocument, WorkflowEdge, WorkflowNode } from "@agentic/contracts";
import type { Edge, Node } from "@xyflow/react";
import type { LiveStatus, NodeTarget, Selection, TargetLookup, ValidationIssue } from "../types";

export type WorkflowNodeData = {
  node: WorkflowNode;
  target?: NodeTarget;
  status?: LiveStatus;
  errors: number;
  warnings: number;
};
export type WorkflowFlowNode = Node<WorkflowNodeData, "workflow">;

type View = {
  lookup: TargetLookup;
  selection: Selection;
  issues: ValidationIssue[];
  statuses?: Record<string, LiveStatus>;
};

export function toFlowNodes(doc: WorkflowDocument, view: View): WorkflowFlowNode[] {
  return doc.nodes.map((node) => {
    const own = view.issues.filter((i) => i.node === node.id);
    return {
      id: node.id,
      type: "workflow",
      position: node.position,
      selected: view.selection?.kind === "node" && view.selection.id === node.id,
      data: {
        node,
        target: view.lookup(node),
        status: view.statuses?.[node.id],
        errors: own.filter((i) => i.severity === "error").length,
        warnings: own.filter((i) => i.severity === "warning").length,
      },
    };
  });
}

/**
 * Plain edges are solid; conditional edges are dashed and labeled; loop
 * edges show their cap. In a run, edges already followed are highlighted.
 */
export function toFlowEdges(
  doc: WorkflowDocument,
  selection: Selection,
  issues: ValidationIssue[],
  taken?: Set<string>,
): Edge[] {
  return doc.edges.map((edge) => {
    const followed = taken?.has(edge.id) ?? false;
    const invalid = issues.some((i) => i.edge === edge.id && i.severity === "error");
    const stroke = invalid ? "var(--danger)" : followed ? "var(--accent)" : "var(--text-subtle)";
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edgeLabel(edge),
      // Loop edges run backwards; a stepped path keeps them off the forward edges.
      type: edge.maxIterations !== null ? "smoothstep" : "default",
      selected: selection?.kind === "edge" && selection.id === edge.id,
      animated: followed && taken !== undefined,
      style: {
        stroke,
        strokeWidth: followed ? 2.5 : 1.5,
        strokeDasharray: edge.condition ? "6 4" : undefined,
      },
      labelStyle: { fill: "var(--text-muted)", fontSize: 11 },
      labelBgStyle: { fill: "var(--surface)" },
    };
  });
}

export function edgeLabel(edge: WorkflowEdge): string {
  const parts = [edge.label || (edge.condition ? "if …" : "")];
  if (edge.maxIterations !== null) parts.push(`↻ ≤${edge.maxIterations}`);
  return parts.filter(Boolean).join(" ");
}

/**
 * Edges a run has followed: the source finished and the target started. A
 * loop edge counts only once its target ran again (`runs` > 1).
 */
export function takenEdges(
  doc: WorkflowDocument,
  statuses: Record<string, LiveStatus>,
  runs: Record<string, number> = {},
): Set<string> {
  const finished = (id: string) => statuses[id] === "succeeded" || statuses[id] === "rejected";
  return new Set(
    doc.edges
      .filter((e) => finished(e.from) && statuses[e.to] !== undefined)
      .filter((e) => e.maxIterations === null || (runs[e.to] ?? 0) > 1)
      .map((e) => e.id),
  );
}
