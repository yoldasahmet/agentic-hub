import type { WorkflowDocument, WorkflowEdge, WorkflowNode } from "@agentic/contracts";

/**
 * The graph as it runs: enabled nodes, and edges between them. An edge into
 * a disabled node continues along that node's unconditional edges, so
 * disabling a step in a chain keeps the chain connected.
 */
export type Topology = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** No incoming edges except loop edges: these start the run. */
  entries: string[];
  /** No outgoing edges except loop edges: their outputs are the default result. */
  exits: string[];
  incoming(id: string): WorkflowEdge[];
  outgoing(id: string): WorkflowEdge[];
};

export const isLoopEdge = (edge: WorkflowEdge) => edge.maxIterations !== null;

export function topology(doc: WorkflowDocument): Topology {
  const nodes = doc.nodes.filter((n) => n.enabled);
  const enabled = new Set(nodes.map((n) => n.id));
  const edges = effectiveEdges(doc, enabled);
  const incoming = (id: string) => edges.filter((e) => e.to === id);
  const outgoing = (id: string) => edges.filter((e) => e.from === id);
  return {
    nodes,
    edges,
    entries: nodes.filter((n) => incoming(n.id).every(isLoopEdge)).map((n) => n.id),
    exits: nodes.filter((n) => outgoing(n.id).every(isLoopEdge)).map((n) => n.id),
    incoming,
    outgoing,
  };
}

function effectiveEdges(doc: WorkflowDocument, enabled: Set<string>): WorkflowEdge[] {
  const ids = new Set(doc.nodes.map((n) => n.id));
  const valid = doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const reach = (id: string, seen: Set<string>): string[] => {
    if (enabled.has(id)) return [id];
    if (seen.has(id)) return [];
    seen.add(id);
    return valid
      .filter((e) => e.from === id && e.condition === null)
      .flatMap((e) => reach(e.to, seen));
  };
  return valid
    .filter((e) => enabled.has(e.from))
    .flatMap((edge) => {
      if (enabled.has(edge.to)) return [edge];
      return reach(edge.to, new Set()).map((to) => ({ ...edge, id: `${edge.id}>${to}`, to }));
    });
}

/** Every node with a path to `id` (loop edges included): the nodes a binding may read. */
export function ancestors(doc: WorkflowDocument, id: string): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const edge of doc.edges) {
      if (edge.to !== current || found.has(edge.from)) continue;
      found.add(edge.from);
      queue.push(edge.from);
    }
  }
  found.delete(id);
  return found;
}

/** Edges that close a cycle with no loop edge on it, which would run forever. */
export function unboundedCycleEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
  const plain = edges.filter((e) => !isLoopEdge(e));
  const reaches = (from: string, to: string) => {
    const seen = new Set<string>();
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.pop() ?? "";
      if (current === to) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const e of plain) if (e.from === current) queue.push(e.to);
    }
    return false;
  };
  return plain.filter((e) => reaches(e.to, e.from));
}
