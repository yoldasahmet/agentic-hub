import { fieldsToSchema, type IoField, type JsonValue } from "@agentic/contracts";
import { SchemaForm } from "../../../patterns/schema-form/schema-form";

type Props = { field: IoField; value: JsonValue | undefined; onChange: (value: JsonValue) => void };

/** A fixed value typed like the field it fills, through the shared SchemaForm. */
export function LiteralInput({ field, value, onChange }: Props) {
  const one: IoField = { ...field, required: false, description: "" };
  return (
    <SchemaForm
      schema={fieldsToSchema([one])}
      value={value === undefined ? {} : { [field.name]: value }}
      onChange={(next) => onChange(next[field.name] ?? null)}
    />
  );
}
