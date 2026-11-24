import { type JsonValue, schemaToFields } from "@agentic/contracts";
import { useId, useState } from "react";
import { Label } from "../../primitives/label";
import { Switch } from "../../primitives/switch";
import { FieldInput } from "./field-input";
import { JsonTextInput } from "./json-text-input";

export type FormValue = Record<string, JsonValue>;

export type SchemaFormProps = {
  /** An object JSON Schema, as agent and workflow I/O store it. */
  schema: unknown;
  value: FormValue;
  onChange: (value: FormValue) => void;
  /** Validation issues as Core reports them: "field: message". */
  issues?: string[];
  disabled?: boolean;
  /** Shown when the schema has no fields. */
  emptyHint?: string;
};

/**
 * A form for any object schema: the playground, run launchers, chat intake,
 * and gates all use it (schema forms, never raw JSON). "Edit as JSON" is
 * the advanced path.
 */
export function SchemaForm({
  schema,
  value,
  onChange,
  issues = [],
  disabled,
  emptyHint,
}: SchemaFormProps) {
  const id = useId();
  const [asJson, setAsJson] = useState(false);
  const fields = schemaToFields(schema);
  const issueFor = (name: string) =>
    issues
      .find((i) => i.startsWith(`${name}:`))
      ?.slice(name.length + 1)
      .trim();
  const general = issues.filter((i) => !fields.some((f) => i.startsWith(`${f.name}:`)));

  return (
    <div className="grid gap-4">
      {fields.length === 0 && <p className="text-fg-muted">{emptyHint ?? "No fields."}</p>}
      {asJson ? (
        <JsonTextInput
          object
          aria-label="Values as JSON"
          disabled={disabled}
          value={value}
          onChange={(next) => onChange(isObject(next) ? next : {})}
        />
      ) : (
        fields.map((field) => {
          const issue = issueFor(field.name);
          return (
            <div key={field.name} className="grid gap-1.5">
              <Label htmlFor={`${id}-${field.name}`}>
                {field.name}
                {field.required && <span className="text-danger-ink"> *</span>}
              </Label>
              {field.description && (
                <p className="-mt-1 text-sm text-fg-muted">{field.description}</p>
              )}
              <FieldInput
                field={field}
                id={`${id}-${field.name}`}
                value={value[field.name]}
                invalid={issue !== undefined}
                disabled={disabled}
                onChange={(next) => {
                  const { [field.name]: _, ...rest } = value;
                  onChange(next === undefined ? rest : { ...rest, [field.name]: next });
                }}
              />
              {issue && <p className="text-sm text-danger-ink">{issue}</p>}
            </div>
          );
        })
      )}
      {general.map((issue) => (
        <p key={issue} className="text-sm text-danger-ink">
          {issue}
        </p>
      ))}
      {fields.length > 0 && (
        <div className="flex items-center gap-2">
          <Switch id={`${id}-json`} checked={asJson} onCheckedChange={setAsJson} />
          <Label htmlFor={`${id}-json`} className="text-sm text-fg-muted">
            Edit as JSON
          </Label>
        </div>
      )}
    </div>
  );
}

/**
 * Starting values: each field's default, when it has one. A yes/no field
 * starts as `false`, which is what its unchecked switch shows.
 */
export function schemaDefaults(schema: unknown): FormValue {
  return Object.fromEntries(
    schemaToFields(schema).flatMap((f) => {
      if (f.default !== undefined) return [[f.name, f.default]];
      return f.type === "bool" ? [[f.name, false]] : [];
    }),
  );
}

function isObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
