import type { ValidationIssue, WorkflowDocument } from "@agentic/contracts";
import {
  autoLayout,
  Button,
  EdgeInspector,
  NodeInspector,
  NodePalette,
  removeEdges,
  removeNodes,
  renameNode,
  type Selection,
  type TargetLookup,
  updateEdge,
  updateNode,
  ValidationPanel,
  WorkflowCanvas,
} from "@agentic/ui";
import { LayoutGrid, Redo2, Undo2 } from "lucide-react";
import { useState } from "react";
import { addPaletteItem } from "./add-node";
import type { useTargets } from "./use-targets";

type Props = {
  doc: WorkflowDocument;
  issues: ValidationIssue[];
  lookup: TargetLookup;
  palette: ReturnType<typeof useTargets>["palette"];
  onChange: (doc: WorkflowDocument, group?: string) => void;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
};

/** Palette · canvas · inspector, with the live validation panel under the inspector. */
export function CanvasTab({ doc, issues, lookup, palette, onChange, history }: Props) {
  const [selection, setSelection] = useState<Selection>(null);
  const node =
    selection?.kind === "node" ? doc.nodes.find((n) => n.id === selection.id) : undefined;
  const edge =
    selection?.kind === "edge" ? doc.edges.find((e) => e.id === selection.id) : undefined;
  const add: Parameters<typeof NodePalette>[0]["onAdd"] = (item) => {
    const added = addPaletteItem(doc, item);
    onChange(added.doc);
    setSelection({ kind: "node", id: added.node.id });
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-56 shrink-0 border-r border-border bg-sidebar">
        <NodePalette agents={palette.agents} workflows={palette.workflows} onAdd={add} />
      </aside>
      <div className="relative min-w-0 flex-1">
        <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-control border border-border bg-surface p-0.5 shadow-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Undo"
            disabled={!history.canUndo}
            onClick={history.undo}
          >
            <Undo2 aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Redo"
            disabled={!history.canRedo}
            onClick={history.redo}
          >
            <Redo2 aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Auto-layout"
            onClick={() => onChange(autoLayout(doc))}
          >
            <LayoutGrid aria-hidden />
          </Button>
        </div>
        <WorkflowCanvas
          document={doc}
          lookup={lookup}
          selection={selection}
          onSelect={setSelection}
          issues={issues}
          onChange={(next) => onChange(next)}
          onDropItem={(item, position) => {
            const added = addPaletteItem(doc, item, position);
            onChange(added.doc);
            setSelection({ kind: "node", id: added.node.id });
          }}
        />
      </div>
      <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-surface">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {node ? (
            <NodeInspector
              key={node.id}
              document={doc}
              node={node}
              lookup={lookup}
              onChange={(next) => onChange(updateNode(doc, next), `node:${next.id}`)}
              onRename={(id) => {
                onChange(renameNode(doc, node.id, id));
                setSelection({ kind: "node", id });
              }}
              onDelete={() => {
                onChange(removeNodes(doc, [node.id]));
                setSelection(null);
              }}
            />
          ) : edge ? (
            <EdgeInspector
              key={edge.id}
              document={doc}
              edge={edge}
              lookup={lookup}
              onChange={(next) => onChange(updateEdge(doc, next), `edge:${next.id}`)}
              onDelete={() => {
                onChange(removeEdges(doc, [edge.id]));
                setSelection(null);
              }}
            />
          ) : (
            <p className="text-fg-muted">
              Select a node or an edge to edit it. Drag from a node's right handle to another node
              to connect them.
            </p>
          )}
        </div>
        <div className="max-h-[40%] shrink-0 overflow-auto border-t border-border">
          <ValidationPanel issues={issues} onSelect={setSelection} />
        </div>
      </aside>
    </div>
  );
}
