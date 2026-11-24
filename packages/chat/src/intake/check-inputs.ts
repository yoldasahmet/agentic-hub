import {
  type JsonSchema,
  type JsonValue,
  jsonValueSchema,
  schemaToFields,
} from "@agentic/contracts";
import { checkJsonSchema } from "@agentic/llm";

/**
 * What is still missing or wrong; empty means the target can run. Missing
 * required fields read as such, not as the validator's type errors.
 */
export function inputIssues(schema: JsonSchema, inputs: Record<string, JsonValue>): string[] {
  const checked = checkJsonSchema(schema, inputs);
  if (checked.ok) return [];
  const missing = schemaToFields(schema)
    .filter((f) => f.required && (inputs[f.name] === undefined || inputs[f.name] === ""))
    .map((f) => f.name);
  const other = checked.issues.filter((issue) => !missing.some((m) => issue.startsWith(`${m}:`)));
  return [...missing.map((name) => `${name}: required`), ...other];
}

/** The one text field of a target that takes a single prompt-like input. */
export function soleTextField(schema: JsonSchema): string | undefined {
  const fields = schemaToFields(schema);
  const [only] = fields;
  return fields.length === 1 && (only?.type === "text" || only?.type === "long")
    ? only.name
    : undefined;
}

/** Keeps only the target's fields, and drops empty values a model returns for "unknown". */
export function knownInputs(schema: JsonSchema, value: unknown): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const names = new Set(schemaToFields(schema).map((f) => f.name));
  const out: Record<string, JsonValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    const parsed = jsonValueSchema.safeParse(raw);
    if (!names.has(key) || !parsed.success || parsed.data === null || parsed.data === "") continue;
    out[key] = parsed.data;
  }
  return out;
}
