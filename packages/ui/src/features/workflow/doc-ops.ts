import type {
  Binding,
  Bindings,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
} from "@agentic/contracts";

/** Pure edits of a workflow document; the editor keeps each result for undo. */

export function updateNode(doc: WorkflowDocument, node: WorkflowNode): WorkflowDocument {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === node.id ? node : n)) };
}

export function updateEdge(doc: WorkflowDocument, edge: WorkflowEdge): WorkflowDocument {
  return { ...doc, edges: doc.edges.map((e) => (e.id === edge.id ? edge : e)) };
}

export function addNode(doc: WorkflowDocument, node: WorkflowNode): WorkflowDocument {
  return { ...doc, nodes: [...doc.nodes, node] };
}

/** Removes nodes, their edges, and bindings that read them. */
export function removeNodes(doc: WorkflowDocument, ids: string[]): WorkflowDocument {
  const gone = new Set(ids);
  const keep = (bindings: Bindings) =>
    Object.fromEntries(Object.entries(bindings).filter(([, b]) => !readsAny(b, gone)));
  return {
    ...doc,
    outputs: keep(doc.outputs),
    nodes: doc.nodes
      .filter((n) => !gone.has(n.id))
      .map((n) => ({ ...n, bindings: keep(n.bindings) })),
    edges: doc.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)),
  };
}

export function removeEdges(doc: WorkflowDocument, ids: string[]): WorkflowDocument {
  const gone = new Set(ids);
  return { ...doc, edges: doc.edges.filter((e) => !gone.has(e.id)) };
}

/** Connects two nodes once; a second edge between the same pair is ignored. */
export function connect(doc: WorkflowDocument, from: string, to: string): WorkflowDocument {
  if (doc.edges.some((e) => e.from === from && e.to === to)) return doc;
  const edge: WorkflowEdge = {
    id: nextEdgeId(doc.edges.map((e) => e.id)),
    from,
    to,
    condition: null,
    maxIterations: null,
    label: "",
  };
  return { ...doc, edges: [...doc.edges, edge] };
}

/** Renames a node and every edge and binding that refers to it. */
export function renameNode(doc: WorkflowDocument, from: string, to: string): WorkflowDocument {
  const rename = (id: string) => (id === from ? to : id);
  const rebind = (bindings: Bindings): Bindings =>
    Object.fromEntries(Object.entries(bindings).map(([k, b]) => [k, renameIn(b, from, to)]));
  return {
    ...doc,
    outputs: rebind(doc.outputs),
    nodes: doc.nodes.map((n) => ({ ...n, id: rename(n.id), bindings: rebind(n.bindings) })),
    edges: doc.edges.map((e) => ({ ...e, from: rename(e.from), to: rename(e.to) })),
  };
}

/** `base`, `base_2`, `base_3`, … whichever no existing id uses. */
export function nextId(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}_${n}`)) return `${base}_${n}`;
}

function nextEdgeId(taken: string[]): string {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(`e${n}`)) return `e${n}`;
}

/** A node id from a name: "PR Summarizer" → "pr_summarizer". */
export function nodeIdFrom(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .replace(/^[^a-z]+/, "")
      .slice(0, 32) || "node";
  return nextId(base, taken);
}

function readsAny(binding: Binding, ids: Set<string>): boolean {
  const reads = (b: { kind: string; node?: string }) => b.kind === "node" && ids.has(b.node ?? "");
  return reads(binding) && (!binding.fallback || reads(binding.fallback));
}

function renameIn(binding: Binding, from: string, to: string): Binding {
  const fallback = binding.fallback;
  const base =
    binding.kind === "node" && binding.node === from ? { ...binding, node: to } : binding;
  if (!fallback) return base;
  return {
    ...base,
    fallback:
      fallback.kind === "node" && fallback.node === from ? { ...fallback, node: to } : fallback,
  };
}
