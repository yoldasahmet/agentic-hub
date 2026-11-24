import type { IoField } from "@agentic/contracts";
import { Plus } from "lucide-react";
import { Button } from "../../primitives/button";
import { fieldIssues, nextFieldName } from "./field-issues";
import { FieldRow } from "./field-row";

export type SchemaEditorProps = {
  fields: IoField[];
  onChange: (fields: IoField[]) => void;
  /** Shown when there are no fields, e.g. "The answer is free text." */
  emptyHint?: string;
  addLabel?: string;
};

/**
 * Edits an agent's (or workflow's) inputs or outputs as fields, never raw
 * JSON. Callers store `fieldsToSchema(fields)` once `fieldIssues` is empty.
 */
export function SchemaEditor({
  fields,
  onChange,
  emptyHint,
  addLabel = "Add field",
}: SchemaEditorProps) {
  const issues = fieldIssues(fields);
  const update = (index: number, field: IoField) =>
    onChange(fields.map((f, i) => (i === index ? field : f)));
  const move = (index: number, delta: -1 | 1) => {
    const next = [...fields];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      {fields.length === 0 && emptyHint && <p className="text-fg-muted">{emptyHint}</p>}
      <ul className="grid gap-2">
        {fields.map((field, index) => (
          <FieldRow
            // Names change while typing; position is the stable identity here.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={index}
            field={field}
            issue={issues.get(index)}
            first={index === 0}
            last={index === fields.length - 1}
            onChange={(next) => update(index, next)}
            onMove={(delta) => move(index, delta)}
            onRemove={() => onChange(fields.filter((_, i) => i !== index))}
          />
        ))}
      </ul>
      <div>
        <Button
          size="sm"
          onClick={() =>
            onChange([
              ...fields,
              { name: nextFieldName(fields), type: "text", description: "", required: false },
            ])
          }
        >
          <Plus aria-hidden /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
