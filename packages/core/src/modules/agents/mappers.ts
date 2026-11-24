import {
  type Agent,
  type AgentVersion,
  agentSpecSchema,
  identityColorSchema,
  identityIconSchema,
} from "@agentic/contracts";
import type { AgentRow, AgentVersionRow } from "./repository";

/** Rows to DTOs. jsonb and text columns are parsed, never cast. */
export function toAgent(row: AgentRow): Agent {
  const draft = agentSpecSchema.parse(row.draft);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: identityColorSchema.catch("slate").parse(row.color),
    icon: identityIconSchema.catch("bot").parse(row.icon),
    kind: draft.kind,
    draft,
    revision: row.revision,
    latestVersion: row.latestVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgentVersion(row: AgentVersionRow): AgentVersion {
  return {
    id: row.id,
    agentId: row.agentId,
    version: row.version,
    spec: agentSpecSchema.parse({
      kind: row.kind,
      inputSchema: row.inputSchema,
      outputSchema: row.outputSchema,
      outputFormat: row.outputFormat,
      prompt: row.prompt,
      runtime: row.runtime,
      capabilities: row.capabilities,
    }),
    createdAt: row.createdAt.toISOString(),
  };
}
