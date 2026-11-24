import { reviewStepName, type WorkflowEdge, type WorkflowNode } from "@agentic/contracts";
import { END } from "@langchain/langgraph";
import { evaluateCondition } from "../jsonlogic";
import type { WorkflowValues } from "./state";

/** The graph node a run enters `node` through: its input review when it has one. */
export const entryStep = (node: WorkflowNode) =>
  node.reviewInput && node.kind !== "gate" ? reviewStepName(node.id, "input") : node.id;

/** The graph node `node` leaves from: its output review when it has one. */
export const exitStep = (node: WorkflowNode) =>
  node.reviewOutput && node.kind !== "gate" ? reviewStepName(node.id, "output") : node.id;

/**
 * Picks the edges to follow after a node: every edge whose condition holds
 * (several run in parallel), except loop edges whose target already ran
 * more than `maxIterations` times. No edge left ends this branch.
 */
export function router(edges: WorkflowEdge[], nodes: Map<string, WorkflowNode>) {
  const route = (state: WorkflowValues): string[] | typeof END => {
    const data = { input: state.input, nodes: state.nodes };
    const targets = new Set<string>();
    for (const edge of edges) {
      const target = nodes.get(edge.to);
      if (!target || !evaluateCondition(edge.condition, data)) continue;
      const runs = state.nodes[edge.to]?.runs ?? 0;
      if (edge.maxIterations !== null && runs > edge.maxIterations) continue;
      targets.add(entryStep(target));
    }
    return targets.size > 0 ? [...targets] : END;
  };
  const destinations = new Set<string>();
  for (const edge of edges) {
    const target = nodes.get(edge.to);
    if (target) destinations.add(entryStep(target));
  }
  return { route, destinations: [...destinations, END] };
}
