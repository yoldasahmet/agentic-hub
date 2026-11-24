import type { AgentRuntimeDeps } from "@agentic/agents";
import { reviewStepName } from "@agentic/contracts";
import type { AssistantDefinition } from "@agentic/graph";
import { buildWorkflowGraph } from "./compiler/compile";
import { entryStep, exitStep } from "./compiler/router";
import type { ResolvedWorkflow } from "./resolve";
import { topology } from "./topology";

type Meta = { id: string; name: string; description: string; version: number };

/** A pinned, resolved workflow as an assistant the LangGraph host can run. */
export function workflowDefinition(
  meta: Meta,
  resolved: ResolvedWorkflow,
  deps: AgentRuntimeDeps,
): AssistantDefinition {
  return {
    ...meta,
    nodes: stepNames(resolved),
    build: (graphDeps) => buildWorkflowGraph(resolved, deps).compile(graphDeps),
  };
}

/** Every graph node name, for "write as node" when editing state. */
function stepNames(resolved: ResolvedWorkflow): string[] {
  return topology(resolved.document).nodes.flatMap((node) =>
    [entryStep(node), node.id, exitStep(node)].filter((name, i, all) => all.indexOf(name) === i),
  );
}

export { reviewStepName };
