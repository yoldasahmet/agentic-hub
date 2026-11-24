import type { AgentRuntimeDeps } from "@agentic/agents";
import type { WorkflowDocument, WorkflowStreamEvent } from "@agentic/contracts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { BindingScope } from "../../bindings";
import type { ResolvedWorkflow } from "../../resolve";
import type { Topology } from "../../topology";
import type { WorkflowValues } from "../state";

/** What every step of one compiled workflow shares. */
export type StepContext = {
  doc: WorkflowDocument;
  resolved: ResolvedWorkflow;
  topo: Topology;
  deps: AgentRuntimeDeps;
};

export const scopeOf = (state: WorkflowValues): BindingScope => ({
  input: state.input,
  nodes: state.nodes,
});

/**
 * The namespace of the graph running this step: empty at the top level,
 * the parent task's path inside a subworkflow. A step's own namespace ends
 * with its task (`node:task`), so that segment is dropped.
 */
export function namespaceOf(config: LangGraphRunnableConfig): string {
  const ns = config.configurable?.checkpoint_ns;
  if (typeof ns !== "string" || ns === "") return "";
  return ns.split("|").slice(0, -1).join("|");
}

export function emit(config: LangGraphRunnableConfig, event: WorkflowStreamEvent): void {
  config.writer?.(event);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
