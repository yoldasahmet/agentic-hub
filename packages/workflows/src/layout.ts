import type { WorkflowDocument } from "@agentic/contracts";
import { isLoopEdge } from "./topology";

const COLUMN = 280;
const ROW = 150;

/**
 * Left-to-right layers by longest path (loop edges ignored), for imported
 * documents without positions. The editor's auto-layout refines this.
 */
export function layoutDocument(doc: WorkflowDocument): WorkflowDocument {
  const forward = doc.edges.filter((e) => !isLoopEdge(e));
  const layer = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = forward.filter((e) => e.to === id).map((e) => depth(e.from, seen) + 1);
    const value = Math.max(0, ...parents);
    layer.set(id, value);
    return value;
  };
  const rows = new Map<number, number>();
  const nodes = doc.nodes.map((node) => {
    const column = depth(node.id, new Set());
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, position: { x: column * COLUMN, y: row * ROW } };
  });
  return { ...doc, nodes };
}

/** True when nothing was placed yet (every node at the origin). */
export const needsLayout = (doc: WorkflowDocument) =>
  doc.nodes.length > 1 && doc.nodes.every((n) => n.position.x === 0 && n.position.y === 0);
