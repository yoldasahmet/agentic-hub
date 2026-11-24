import { describe, expect, it } from "vitest";
import {
  fieldsToSchema,
  hasFields,
  type IoField,
  schemaToFields,
  withoutUiKeywords,
} from "./io-schema";

const fields: IoField[] = [
  { name: "title", type: "text", description: "Short title", required: true },
  { name: "body", type: "long", description: "", required: false, default: "n/a" },
  { name: "score", type: "number", description: "", required: false, min: 0, max: 10 },
  { name: "count", type: "integer", description: "", required: true },
  { name: "draft", type: "bool", description: "", required: false },
  { name: "level", type: "select", description: "", required: false, options: ["low", "high"] },
  { name: "tags", type: "multi", description: "", required: false, options: ["a", "b"] },
  { name: "meta", type: "json", description: "", required: false },
];

describe("fieldsToSchema / schemaToFields", () => {
  it("round-trips every field type losslessly, in order", () => {
    expect(schemaToFields(fieldsToSchema(fields))).toEqual(fields);
  });

  it("keeps the field order through a key-sorting store (jsonb)", () => {
    const schema = fieldsToSchema(fields);
    const properties = schema.properties as Record<string, unknown>;
    const sorted = Object.fromEntries(
      Object.entries(properties).sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(schemaToFields({ ...schema, properties: sorted }).map((f) => f.name)).toEqual(
      fields.map((f) => f.name),
    );
  });

  it("writes standard JSON Schema next to the editor hints", () => {
    const schema = fieldsToSchema(fields);
    expect(schema).toMatchObject({
      type: "object",
      required: ["title", "count"],
      additionalProperties: false,
      properties: {
        title: { type: "string", "x-ui-type": "text", description: "Short title" },
        score: { type: "number", minimum: 0, maximum: 10 },
        level: { type: "string", enum: ["low", "high"] },
        tags: { type: "array", items: { type: "string", enum: ["a", "b"] } },
      },
    });
  });

  it("infers fields from foreign schemas without editor hints", () => {
    const foreign = {
      type: "object",
      properties: {
        name: { type: "string" },
        mode: { type: "string", enum: ["x", "y"] },
        ok: { type: "boolean" },
        list: { type: "array" },
        n: { type: "integer" },
        anything: {},
        "bad name": { type: "string" },
      },
      required: ["name"],
    };
    expect(schemaToFields(foreign).map((f) => [f.name, f.type, f.required])).toEqual([
      ["name", "text", true],
      ["mode", "select", false],
      ["ok", "bool", false],
      ["list", "multi", false],
      ["n", "integer", false],
      ["anything", "json", false],
    ]);
  });

  it("reads non-object schemas as no fields", () => {
    expect(schemaToFields(null)).toEqual([]);
    expect(schemaToFields("text")).toEqual([]);
    expect(hasFields(fieldsToSchema([]))).toBe(false);
    expect(hasFields(fieldsToSchema(fields))).toBe(true);
  });

  it("strips editor keywords deeply for strict validators", () => {
    const stripped = withoutUiKeywords(fieldsToSchema(fields));
    expect(JSON.stringify(stripped)).not.toContain("x-ui-");
    expect(stripped).toMatchObject({ properties: { title: { type: "string" } } });
  });
});
