import { type Bindings, schemaToFields, type WorkflowDocument } from "@agentic/contracts";
import type { TargetLookup } from "../types";
import { BindingPicker } from "./binding-picker";
import { bindingSources } from "./sources";

type Props = {
  document: WorkflowDocument;
  lookup: TargetLookup;
  onChange: (outputs: Bindings) => void;
};

/** Where each workflow output comes from. With nothing mapped, exit nodes' outputs are merged. */
export function OutputMapping({ document, lookup, onChange }: Props) {
  const fields = schemaToFields(document.outputSchema);
  const sources = bindingSources(document, null, lookup);
  if (fields.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No output fields: the run's output is what the last nodes produced.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {fields.map((field) => (
        <div key={field.name} className="grid gap-1">
          <span className="font-mono text-sm">{field.name}</span>
          <BindingPicker
            field={field}
            value={document.outputs[field.name]}
            sources={sources}
            onChange={(binding) => {
              const next = { ...document.outputs };
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
