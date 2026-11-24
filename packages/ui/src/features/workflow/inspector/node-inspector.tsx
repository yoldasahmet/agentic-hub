import { type WorkflowDocument, type WorkflowNode, workflowNodeIdSchema } from "@agentic/contracts";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { EntityAvatar } from "../../../patterns/entity-avatar";
import { Button } from "../../../primitives/button";
import { Input } from "../../../primitives/input";
import { Label } from "../../../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import { gateEntity, type TargetLookup } from "../types";
import { GateSettings } from "./gate-settings";
import { NodeBehavior } from "./node-behavior";
import { NodeBindings } from "./node-bindings";

export type NodeInspectorProps = {
  document: WorkflowDocument;
  node: WorkflowNode;
  lookup: TargetLookup;
  onChange: (node: WorkflowNode) => void;
  onRename: (id: string) => void;
  onDelete: () => void;
};

/** The selected node: name, id, pinned version, inputs (bindings), gate fields, and behavior. */
export function NodeInspector({
  document,
  node,
  lookup,
  onChange,
  onRename,
  onDelete,
}: NodeInspectorProps) {
  const id = useId();
  const target = lookup(node);
  const entity = node.kind === "gate" ? gateEntity : target?.entity;
  const incoming = document.edges.filter((e) => e.to === node.id).length;
  return (
    <div className="grid gap-5">
      <header className="flex items-center gap-2">
        {entity && (
          <EntityAvatar
            color={entity.color}
            icon={node.kind === "workflow" ? "workflow" : entity.icon}
          />
        )}
        <div className="grid min-w-0 flex-1">
          <span className="truncate font-medium">{entity?.name ?? "Missing target"}</span>
          <span className="text-xs text-fg-subtle">
            {node.kind === "agent"
              ? "Agent"
              : node.kind === "workflow"
                ? "Subworkflow"
                : "Human gate"}
          </span>
        </div>
        <Button size="icon" variant="ghost" aria-label="Delete node" onClick={onDelete}>
          <Trash2 aria-hidden />
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-label`}>Label</Label>
          <Input
            id={`${id}-label`}
            placeholder={entity?.name}
            value={node.label}
            onChange={(event) => onChange({ ...node, label: event.target.value })}
          />
        </div>
        <NodeIdField
          key={node.id}
          id={node.id}
          taken={document.nodes.map((n) => n.id)}
          onRename={onRename}
        />
      </div>
      {node.kind !== "gate" && target && (
        <div className="grid gap-1.5">
          <Label>Version</Label>
          <Select
            value={String(node.version)}
            onValueChange={(v) =>
              onChange({ ...node, version: v === "latest" ? "latest" : Number(v) })
            }
          >
            <SelectTrigger aria-label="Version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">
                Latest published
                {target.latestVersion ? ` (v${target.latestVersion})` : " (none yet)"}
              </SelectItem>
              {target.versions.map((v) => (
                <SelectItem key={v} value={String(v)}>{`v${v}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {node.kind === "gate" && <GateSettings key={node.id} node={node} onChange={onChange} />}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">
          {node.kind === "gate" ? "Fill the fields from" : "Inputs"}
        </h3>
        <NodeBindings
          document={document}
          node={node}
          lookup={lookup}
          onChange={(bindings) => onChange({ ...node, bindings })}
        />
      </section>
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Behavior</h3>
        <NodeBehavior node={node} incoming={incoming} onChange={onChange} />
      </section>
    </div>
  );
}

/** The id is used in conditions and bindings, so it changes on blur, once valid and unique. */
function NodeIdField({
  id,
  taken,
  onRename,
}: {
  id: string;
  taken: string[];
  onRename: (id: string) => void;
}) {
  const inputId = useId();
  const [text, setText] = useState(id);
  useEffect(() => setText(id), [id]);
  const parsed = workflowNodeIdSchema.safeParse(text);
  const problem = !parsed.success
    ? (parsed.error.issues[0]?.message ?? "Invalid id")
    : text !== id && taken.includes(text)
      ? "Another node uses this id"
      : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>Id</Label>
      <Input
        id={inputId}
        aria-invalid={problem !== undefined}
        title={problem}
        className="font-mono text-code"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => (problem ? setText(id) : text !== id && onRename(text))}
      />
    </div>
  );
}
