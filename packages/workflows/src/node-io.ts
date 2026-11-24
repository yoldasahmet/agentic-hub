import { hasFields, type JsonSchema, type WorkflowNode } from "@agentic/contracts";
import { type CatalogLookup, catalogKey, type ValidationCatalog } from "./catalog";

export type NodeIo = { inputSchema: JsonSchema; outputSchema: JsonSchema };

/** A free-text agent answers `{ text }`; give it that field so bindings can pick it. */
const textOutput: JsonSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
};

/** A gate outputs its (possibly edited) fields plus the reviewer's decision. */
export function gateOutputSchema(schema: JsonSchema): JsonSchema {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  return {
    type: "object",
    properties: {
      ...properties,
      approved: { type: "boolean" },
      comment: { type: "string" },
    },
  };
}

export function lookupTarget(node: WorkflowNode, catalog: ValidationCatalog): CatalogLookup | null {
  if (node.kind === "gate") return null;
  return node.kind === "agent"
    ? (catalog.agents.get(catalogKey(node.agentId, node.version)) ?? { status: "missing" })
    : (catalog.workflows.get(catalogKey(node.workflowId, node.version)) ?? { status: "missing" });
}

/** The node's input and output schemas, when its target is known. */
export function nodeIo(node: WorkflowNode, catalog: ValidationCatalog): NodeIo | undefined {
  if (node.kind === "gate") {
    return { inputSchema: node.schema, outputSchema: gateOutputSchema(node.schema) };
  }
  const found = lookupTarget(node, catalog);
  if (found?.status !== "ok") return undefined;
  const { inputSchema, outputSchema } = found.entry;
  return { inputSchema, outputSchema: hasFields(outputSchema) ? outputSchema : textOutput };
}

/** Field name → JSON Schema `type` (or undefined) of an object schema. */
export function fieldTypes(schema: JsonSchema): Map<string, string | undefined> {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  return new Map(
    Object.entries(properties).map(([name, prop]) => [
      name,
      isRecord(prop) && typeof prop.type === "string" ? prop.type : undefined,
    ]),
  );
}

export function requiredFields(schema: JsonSchema): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter((f): f is string => typeof f === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
