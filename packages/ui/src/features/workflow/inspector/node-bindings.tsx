import type { Bindings, WorkflowDocument, WorkflowNode } from "@agentic/contracts";
import type { TargetLookup } from "../types";
import { BindingPicker } from "./binding-picker";
import { bindingSources, inputFields } from "./sources";

type Props = {
  document: WorkflowDocument;
  node: WorkflowNode;
  lookup: TargetLookup;
  onChange: (bindings: Bindings) => void;
};

/** One picker per input of the node's target: where each value comes from. */
export function NodeBindings({ document, node, lookup, onChange }: Props) {
  const fields = inputFields(node, lookup);
  const sources = bindingSources(document, node.id, lookup);
  if (fields.length === 0) {
    return <p className="text-sm text-fg-muted">This node takes no inputs.</p>;
  }
  return (
    <div className="grid gap-3">
      {fields.map((field) => (
        <div key={field.name} className="grid gap-1">
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="font-mono">{field.name}</span>
            {field.required && <span className="text-danger">required</span>}
            <span className="text-xs text-fg-subtle">{field.type}</span>
          </span>
          <BindingPicker
            field={field}
            value={node.bindings[field.name]}
            sources={sources}
            onChange={(binding) => {
              const next = { ...node.bindings };
              if (binding) next[field.name] = binding;
              else delete next[field.name];
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}
