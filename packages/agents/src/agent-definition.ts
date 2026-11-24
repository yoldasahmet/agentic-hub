import { type AgentSpec, AppError, agentSpecSchema } from "@agentic/contracts";
import type { AssistantDefinition } from "@agentic/graph";
import { buildAgentGraph } from "./agent-graph";
import { AGENT_NODE } from "./agent-state";
import type { AgentRuntimeDeps } from "./deps";

type Meta = { id: string; name: string; description: string; version: number };

/** A published agent version as an assistant: the graph is pinned to that spec. */
export function agentVersionDefinition(
  meta: Meta,
  spec: AgentSpec,
  deps: AgentRuntimeDeps,
): AssistantDefinition {
  return {
    ...meta,
    nodes: [AGENT_NODE],
    build: (graphDeps) => buildAgentGraph(() => spec, deps, graphDeps),
  };
}

/** An agent's draft as an assistant: each run carries its own spec snapshot in `spec`. */
export function agentDraftDefinition(meta: Meta, deps: AgentRuntimeDeps): AssistantDefinition {
  return {
    ...meta,
    nodes: [AGENT_NODE],
    build: (graphDeps) =>
      buildAgentGraph(
        (state) => {
          const parsed = agentSpecSchema.safeParse(state.spec);
          if (!parsed.success) {
            throw new AppError("validation_failed", "This draft run has no agent spec");
          }
          return parsed.data;
        },
        deps,
        graphDeps,
      ),
  };
}
