import type { WorkflowDocument } from "@agentic/contracts";
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { connect, removeEdges, removeNodes } from "../doc-ops";
import {
  type LiveStatus,
  type PaletteItem,
  paletteItemSchema,
  type Selection,
  type TargetLookup,
  type ValidationIssue,
} from "../types";
import { takenEdges, toFlowEdges, toFlowNodes, type WorkflowFlowNode } from "./to-flow";
import { WorkflowNodeView } from "./workflow-node";

export const PALETTE_MIME = "application/x-agentic-node";

export type WorkflowCanvasProps = {
  document: WorkflowDocument;
  lookup: TargetLookup;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  issues?: ValidationIssue[];
  /** A live run: node statuses, and the edges it followed are highlighted. */
  statuses?: Record<string, LiveStatus>;
  /** How many times each node ran, so a loop edge lights up only when it looped. */
  runs?: Record<string, number>;
  /** Omit for a read-only canvas (run views). */
  onChange?: (document: WorkflowDocument) => void;
  /** An item dropped from the palette, at a canvas position. */
  onDropItem?: (item: PaletteItem, position: { x: number; y: number }) => void;
};

const nodeTypes: NodeTypes = { workflow: WorkflowNodeView };
/** Stable, so the derived nodes don't change on every render. */
const NO_ISSUES: ValidationIssue[] = [];

/** The workflow graph on React Flow: drag, connect, delete, select, minimap, and live status. */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  document,
  lookup,
  selection,
  onSelect,
  issues = NO_ISSUES,
  statuses,
  runs,
  onChange,
  onDropItem,
}: WorkflowCanvasProps) {
  const flow = useReactFlow();
  const derived = useMemo(
    () => toFlowNodes(document, { lookup, selection, issues, statuses }),
    [document, lookup, selection, issues, statuses],
  );
  // Positions move locally while dragging and are committed when the drag ends.
  const [nodes, setNodes] = useState<WorkflowFlowNode[]>(derived);
  useEffect(() => setNodes(derived), [derived]);
  const edges = useMemo(
    () =>
      toFlowEdges(
        document,
        selection,
        issues,
        statuses ? takenEdges(document, statuses, runs) : undefined,
      ),
    [document, selection, issues, statuses, runs],
  );
  const editable = onChange !== undefined;
  // The first fit can run before the panels around the canvas have their size; fit again once laid out.
  useEffect(() => {
    const timer = setTimeout(() => void flow.fitView({ padding: 0.2, maxZoom: 1.2 }), 80);
    return () => clearTimeout(timer);
  }, [flow]);

  const onNodesChange = (changes: NodeChange<WorkflowFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    if (!onChange) return;
    const moved = changes.flatMap((c) =>
      c.type === "position" && !c.dragging && c.position ? [c] : [],
    );
    if (moved.length > 0) {
      const at = new Map(moved.map((c) => [c.id, c.position]));
      onChange({
        ...document,
        nodes: document.nodes.map((n) => {
          const position = at.get(n.id);
          return position
            ? { ...n, position: { x: Math.round(position.x), y: Math.round(position.y) } }
            : n;
        }),
      });
    }
  };

  const onDrop = (event: DragEvent) => {
    const raw = event.dataTransfer.getData(PALETTE_MIME);
    if (!raw || !onDropItem) return;
    event.preventDefault();
    const item = parseItem(raw);
    if (item) onDropItem(item, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodesDelete={(deleted) =>
        onChange?.(
          removeNodes(
            document,
            deleted.map((n) => n.id),
          ),
        )
      }
      onEdgesDelete={(deleted) =>
        onChange?.(
          removeEdges(
            document,
            deleted.map((e) => e.id),
          ),
        )
      }
      onConnect={({ source, target }) => onChange?.(connect(document, source, target))}
      onNodeClick={(_, node) => onSelect({ kind: "node", id: node.id })}
      onEdgeClick={(_, edge) => onSelect({ kind: "edge", id: edge.id })}
      onPaneClick={() => onSelect(null)}
      onDragOver={(event) => {
        if (editable) event.preventDefault();
      }}
      onDrop={onDrop}
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable
      deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
      minZoom={0.15}
      proOptions={{ hideAttribution: true }}
      className="bg-canvas"
    >
      <Background gap={20} color="var(--border)" />
      <MiniMap
        pannable
        zoomable
        className="bg-surface!"
        maskColor="var(--surface-sunken)"
        nodeColor={(node: WorkflowFlowNode) => {
          const color = node.data.node.kind === "gate" ? undefined : node.data.target?.entity.color;
          return color ? `var(--id-${color})` : "var(--text-subtle)";
        }}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function parseItem(raw: string): PaletteItem | undefined {
  try {
    return paletteItemSchema.safeParse(JSON.parse(raw)).data;
  } catch {
    return undefined;
  }
}
