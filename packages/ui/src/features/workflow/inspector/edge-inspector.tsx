import type { WorkflowDocument, WorkflowEdge } from "@agentic/contracts";
import { Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "../../../primitives/button";
import { Input } from "../../../primitives/input";
import { Label } from "../../../primitives/label";
import { Switch } from "../../../primitives/switch";
import type { TargetLookup } from "../types";
import { ConditionBuilder } from "./condition-builder";
import { outputFields } from "./sources";

export type EdgeInspectorProps = {
  document: WorkflowDocument;
  edge: WorkflowEdge;
  lookup: TargetLookup;
  onChange: (edge: WorkflowEdge) => void;
  onDelete: () => void;
};

/** An edge: its label, when it is followed, and whether it is a capped loop. */
export function EdgeInspector({ document, edge, lookup, onChange, onDelete }: EdgeInspectorProps) {
  const id = useId();
  const paths = [
    ...Object.keys(objectProps(document.inputSchema)).map((f) => ({
      path: `input.${f}`,
      label: `Input › ${f}`,
    })),
    ...document.nodes.flatMap((node) => [
      ...outputFields(node, lookup).map((f) => ({
        path: `nodes.${node.id}.output.${f.name}`,
        label: `${node.label || node.id} › ${f.name}`,
      })),
      { path: `nodes.${node.id}.runs`, label: `${node.label || node.id} › times run` },
    ]),
  ];
  const loop = edge.maxIterations !== null;
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          {edge.from} → {edge.to}
        </h2>
        <Button size="icon" variant="ghost" aria-label="Delete edge" onClick={onDelete}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-label`}>Label</Label>
        <Input
          id={`${id}-label`}
          placeholder="e.g. approved"
          value={edge.label}
          onChange={(event) => onChange({ ...edge, label: event.target.value })}
        />
      </div>
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">Follow when</h3>
        <ConditionBuilder
          value={edge.condition}
          paths={paths}
          onChange={(condition) => onChange({ ...edge, condition })}
        />
      </section>
      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${id}-loop`}>Loop back (capped)</Label>
          <Switch
            id={`${id}-loop`}
            checked={loop}
            onCheckedChange={(on) => onChange({ ...edge, maxIterations: on ? 3 : null })}
          />
        </div>
        {loop && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`${id}-max`} className="text-fg-muted">
              Max iterations
            </Label>
            <Input
              id={`${id}-max`}
              type="number"
              min={1}
              max={100}
              className="w-20"
              value={edge.maxIterations ?? 1}
              onChange={(event) =>
                onChange({ ...edge, maxIterations: clamp(Number(event.target.value), 1, 100) })
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(n) || min));

function objectProps(schema: Record<string, unknown>): Record<string, unknown> {
  const props = schema.properties;
  return props !== null && typeof props === "object" && !Array.isArray(props) ? { ...props } : {};
}
