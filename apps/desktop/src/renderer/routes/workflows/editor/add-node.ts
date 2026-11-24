import { type WorkflowDocument, type WorkflowNode, workflowNodeSchema } from "@agentic/contracts";
import { addNode, nodeIdFrom, type PaletteItem } from "@agentic/ui";

/** A palette item as a new node, at `position` or right of the rightmost node. */
export function addPaletteItem(
  doc: WorkflowDocument,
  item: PaletteItem,
  position?: { x: number; y: number },
): { doc: WorkflowDocument; node: WorkflowNode } {
  const right = Math.max(-280, ...doc.nodes.map((n) => n.position.x));
  const at = position ?? { x: right + 280, y: doc.nodes.at(-1)?.position.y ?? 0 };
  const id = nodeIdFrom(
    item.kind === "gate" ? "gate" : item.entity.name,
    doc.nodes.map((n) => n.id),
  );
  const base = { id, position: { x: Math.round(at.x), y: Math.round(at.y) } };
  const node = workflowNodeSchema.parse(
    item.kind === "agent"
      ? { ...base, kind: "agent", agentId: item.id }
      : item.kind === "workflow"
        ? { ...base, kind: "workflow", workflowId: item.id }
        : { ...base, kind: "gate" },
  );
  return { doc: addNode(doc, node), node };
}
