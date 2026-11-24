import { z } from "zod";
import type { JsonSchema } from "../llm/request";

/**
 * The field model the I/O editor works with, converted losslessly to and
 * from JSON Schema (what agent versions store). `x-ui-type` keeps the
 * editor's choice where JSON Schema alone is ambiguous (text vs. long).
 */
export const ioFieldTypes = [
  "text",
  "long",
  "number",
  "integer",
  "bool",
  "select",
  "multi",
  "json",
] as const;
export const ioFieldTypeSchema = z.enum(ioFieldTypes);
export type IoFieldType = z.infer<typeof ioFieldTypeSchema>;

export const ioFieldNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, digits, and _ (not first)");

export const ioFieldSchema = z.object({
  name: ioFieldNameSchema,
  type: ioFieldTypeSchema,
  description: z.string().max(500).default(""),
  required: z.boolean().default(false),
  /** Choices for `select` and `multi`. */
  options: z.array(z.string().min(1)).optional(),
  default: z.json().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type IoField = z.infer<typeof ioFieldSchema>;

/**
 * An object schema with fields: the shape every agent input and output
 * uses. `x-ui-order` keeps the field order, because Postgres `jsonb`
 * re-sorts object keys.
 */
export function fieldsToSchema(fields: IoField[]): JsonSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const field of fields) properties[field.name] = fieldToProperty(field);
  const required = fields.filter((f) => f.required).map((f) => f.name);
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    "x-ui-order": fields.map((f) => f.name),
  };
}

function fieldToProperty(field: IoField): Record<string, unknown> {
  const prop: Record<string, unknown> = { "x-ui-type": field.type };
  if (field.description) prop.description = field.description;
  if (field.default !== undefined) prop.default = field.default;
  switch (field.type) {
    case "text":
    case "long":
      prop.type = "string";
      break;
    case "number":
    case "integer":
      prop.type = field.type;
      if (field.min !== undefined) prop.minimum = field.min;
      if (field.max !== undefined) prop.maximum = field.max;
      break;
    case "bool":
      prop.type = "boolean";
      break;
    case "select":
      prop.type = "string";
      if (field.options?.length) prop.enum = field.options;
      break;
    case "multi":
      prop.type = "array";
      prop.items = field.options?.length
        ? { type: "string", enum: field.options }
        : { type: "string" };
      break;
    case "json":
      break;
  }
  return prop;
}

const propertySchema = z
  .object({
    type: z.unknown().optional(),
    "x-ui-type": ioFieldTypeSchema.optional().catch(undefined),
    description: z.string().optional().catch(undefined),
    default: z.json().optional().catch(undefined),
    enum: z.array(z.string()).optional().catch(undefined),
    items: z
      .object({ enum: z.array(z.string()).optional().catch(undefined) })
      .optional()
      .catch(undefined),
    minimum: z.number().optional().catch(undefined),
    maximum: z.number().optional().catch(undefined),
  })
  .loose();

const objectSchema = z.object({
  properties: z.record(z.string(), z.unknown()).catch({}),
  required: z.array(z.string()).catch([]),
  "x-ui-order": z.array(z.string()).catch([]),
});

/** Reads any object JSON Schema back into fields; unknown shapes become `json` fields. */
export function schemaToFields(schema: unknown): IoField[] {
  const parsed = objectSchema.safeParse(schema);
  if (!parsed.success) return [];
  const required = new Set(parsed.data.required);
  const order = parsed.data["x-ui-order"];
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  const entries = Object.entries(parsed.data.properties).sort(([a], [b]) => rank(a) - rank(b));
  return entries.flatMap(([name, raw]) => {
    if (!ioFieldNameSchema.safeParse(name).success) return [];
    const p = propertySchema.safeParse(raw).data ?? propertySchema.parse({});
    const options = p.enum ?? p.items?.enum;
    return [
      {
        name,
        type: p["x-ui-type"] ?? inferType(p.type, p.enum !== undefined),
        description: p.description ?? "",
        required: required.has(name),
        ...(options ? { options } : {}),
        ...(p.default !== undefined ? { default: p.default } : {}),
        ...(p.minimum !== undefined ? { min: p.minimum } : {}),
        ...(p.maximum !== undefined ? { max: p.maximum } : {}),
      },
    ];
  });
}

function inferType(type: unknown, hasEnum: boolean): IoFieldType {
  if (type === "number" || type === "integer") return type;
  if (type === "boolean") return "bool";
  if (type === "array") return "multi";
  if (type === "string") return hasEnum ? "select" : "text";
  return "json";
}

/** True when the schema declares at least one field: the agent must answer with that object. */
export function hasFields(schema: unknown): boolean {
  return schemaToFields(schema).length > 0;
}

/**
 * The schema without editor keywords (`x-ui-*`), for providers whose
 * validators run in strict mode and reject unknown keywords.
 */
export function withoutUiKeywords(schema: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !key.startsWith("x-ui-"))
      .map(([key, value]) => [key, stripValue(value)]),
  );
}

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue);
  if (value !== null && typeof value === "object") {
    return withoutUiKeywords(Object.fromEntries(Object.entries(value)));
  }
  return value;
}
