import {
  type AgentSpec,
  agentSpecSchema,
  fieldsToSchema,
  type IoField,
  newId,
  type WorkflowDocument,
  type WorkflowDocumentInput,
  type WorkflowEdge,
  workflowDocumentSchema,
} from "@agentic/contracts";
import type { CatalogLookup, ValidationCatalog } from "../catalog";
import { catalogKey } from "../catalog";

export const text = (name: string, required = false): IoField => ({
  name,
  type: "text",
  description: "",
  required,
});

export const schema = (...fields: IoField[]) => fieldsToSchema(fields);

/** A workflow document with a `task` input; nodes and edges parsed with defaults. */
export function doc(input: Partial<WorkflowDocumentInput> = {}): WorkflowDocument {
  return workflowDocumentSchema.parse({
    inputSchema: schema(text("task", true)),
    outputSchema: schema(),
    ...input,
  });
}

export const edge = (from: string, to: string, extra: Partial<WorkflowEdge> = {}) => ({
  id: `${from}-${to}`,
  from,
  to,
  ...extra,
});

/** An `llm` agent on the fake provider, with `task` in and the given output fields. */
export function llmSpec(
  outputs: IoField[] = [],
  inputs: IoField[] = [text("task", true)],
): AgentSpec {
  return agentSpecSchema.parse({
    kind: "llm",
    inputSchema: schema(...inputs),
    outputSchema: schema(...outputs),
    prompt: { system: "", template: "{{input.task}}" },
    runtime: { model: { providerId: "fake", model: "fake-1" }, maxRepairs: 0 },
  });
}

/** A catalog where each agent id maps to a published entry (pin `latest` and v1). */
export function catalog(
  agents: Record<string, AgentSpec>,
  overrides: Record<string, CatalogLookup> = {},
): ValidationCatalog {
  const map = new Map<string, CatalogLookup>();
  for (const [id, spec] of Object.entries(agents)) {
    const entry = {
      status: "ok" as const,
      entry: {
        name: id,
        inputSchema: spec.inputSchema,
        outputSchema: spec.outputSchema,
        published: true,
      },
    };
    map.set(catalogKey(id, "latest"), entry);
    map.set(catalogKey(id, 1), entry);
  }
  for (const [key, lookup] of Object.entries(overrides)) map.set(key, lookup);
  return { agents: map, workflows: new Map() };
}

export const agentId = () => newId();
