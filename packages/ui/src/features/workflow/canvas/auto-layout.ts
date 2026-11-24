import type { WorkflowDocument } from "@agentic/contracts";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 224;
const NODE_HEIGHT = 60;

/** Left-to-right layout with dagre. Loop edges don't pull nodes backwards. */
export function autoLayout(doc: WorkflowDocument): WorkflowDocument {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of doc.nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of doc.edges) {
    if (edge.maxIterations === null) graph.setEdge(edge.from, edge.to);
  }
  dagre.layout(graph);
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      const placed = graph.node(node.id);
      if (!placed) return node;
      return {
        ...node,
        position: {
          x: Math.round(placed.x - NODE_WIDTH / 2),
          y: Math.round(placed.y - NODE_HEIGHT / 2),
        },
      };
    }),
  };
}
