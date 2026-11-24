import {
  fieldsToSchema,
  type IoField,
  schemaToFields,
  type WorkflowDocument,
} from "@agentic/contracts";
import { fieldIssues, OutputMapping, SchemaEditor, type TargetLookup } from "@agentic/ui";
import { useState } from "react";

type Props = {
  doc: WorkflowDocument;
  lookup: TargetLookup;
  onChange: (doc: WorkflowDocument, group?: string) => void;
};

/** The workflow's inputs (what runs and chat ask for), its outputs, and where each output comes from. */
export function IoTab({ doc, lookup, onChange }: Props) {
  // Field names may be mid-edit; schemas are stored once the fields are valid.
  const [inputs, setInputs] = useState(() => schemaToFields(doc.inputSchema));
  const [outputs, setOutputs] = useState(() => schemaToFields(doc.outputSchema));
  const commit = (key: "inputSchema" | "outputSchema", fields: IoField[]) => {
    if (fieldIssues(fields).size === 0) onChange({ ...doc, [key]: fieldsToSchema(fields) }, key);
  };
  return (
    <div className="grid gap-6 overflow-auto p-4 lg:grid-cols-2">
      <section className="grid content-start gap-3">
        <div>
          <h2 className="font-serif text-lg">Inputs</h2>
          <p className="text-fg-muted">
            What a run needs. The run launcher and chat ask for these.
          </p>
        </div>
        <SchemaEditor
          fields={inputs}
          emptyHint="This workflow takes no inputs."
          onChange={(fields) => {
            setInputs(fields);
            commit("inputSchema", fields);
          }}
        />
      </section>
      <section className="grid content-start gap-3">
        <div>
          <h2 className="font-serif text-lg">Outputs</h2>
          <p className="text-fg-muted">The result of a run, mapped from the nodes' outputs.</p>
        </div>
        <SchemaEditor
          fields={outputs}
          emptyHint="No output fields: the last nodes' outputs are the result."
          onChange={(fields) => {
            setOutputs(fields);
            commit("outputSchema", fields);
          }}
        />
        <h3 className="mt-2 font-medium">Output mapping</h3>
        <OutputMapping
          document={doc}
          lookup={lookup}
          onChange={(outputs) => onChange({ ...doc, outputs }, "outputs")}
        />
      </section>
    </div>
  );
}
