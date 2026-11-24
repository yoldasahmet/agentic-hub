import type { JsonSchema, VersionPin, WorkflowNode } from "@agentic/contracts";

/** What validation and the editor know about a node's target at its pinned version. */
export type CatalogEntry = {
  name: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** False when the pin is `latest` and nothing is published (the draft's schemas are used). */
  published: boolean;
  /** Subworkflows: every workflow id this version reaches, itself included. */
  reaches?: string[];
};

export type CatalogLookup =
  | { status: "ok"; entry: CatalogEntry }
  | { status: "missing" }
  | { status: "unknown_version" };

/** Loaded by Core for the refs a document uses, so validation itself stays pure. */
export type ValidationCatalog = {
  agents: Map<string, CatalogLookup>;
  workflows: Map<string, CatalogLookup>;
};

export const catalogKey = (id: string, pin: VersionPin) => `${id}@${pin}`;

/** The refs a document needs in its catalog. */
export function catalogRefs(nodes: WorkflowNode[]) {
  const agents = new Map<string, { id: string; pin: VersionPin }>();
  const workflows = new Map<string, { id: string; pin: VersionPin }>();
  for (const node of nodes) {
    if (node.kind === "agent") {
      agents.set(catalogKey(node.agentId, node.version), { id: node.agentId, pin: node.version });
    } else if (node.kind === "workflow") {
      const key = catalogKey(node.workflowId, node.version);
      workflows.set(key, { id: node.workflowId, pin: node.version });
    }
  }
  return { agents: [...agents.values()], workflows: [...workflows.values()] };
}
