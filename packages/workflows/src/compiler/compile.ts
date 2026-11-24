import type { AgentRuntimeDeps } from "@agentic/agents";
import { type JsonSchema, reviewStepName, type WorkflowNode } from "@agentic/contracts";
import { END, type LangGraphRunnableConfig, START, StateGraph } from "@langchain/langgraph";
import type { ResolvedWorkflow } from "../resolve";
import { topology } from "../topology";
import { entryStep, exitStep, router } from "./router";
import { WorkflowGraphState, type WorkflowUpdate, type WorkflowValues } from "./state";
import { agentStep } from "./steps/agent-step";
import type { StepContext } from "./steps/context";
import { gateStep } from "./steps/gate-step";
import { reviewStep } from "./steps/review-step";
import { subworkflowStep } from "./steps/subworkflow-step";

type Step = (state: WorkflowValues, config: LangGraphRunnableConfig) => Promise<WorkflowUpdate>;
type StepEntry = [string, Step, { defer?: boolean }];

/**
 * Compiles a pinned, resolved workflow to a LangGraph `StateGraph`:
 * - each enabled node is a graph node (plus review steps around it);
 * - entry nodes start from START; nodes without edges end at END;
 * - outgoing edges become a router (conditions, parallel fan-out, loop caps);
 * - a node with several incoming edges is deferred (`join: all`), so it
 *   runs once after every branch still running has finished.
 * Subworkflows compile the same way, without a checkpointer of their own.
 */
export function buildWorkflowGraph(resolved: ResolvedWorkflow, deps: AgentRuntimeDeps) {
  const doc = resolved.document;
  const topo = topology(doc);
  const ctx: StepContext = { doc, resolved, topo, deps };
  const nodes = new Map(topo.nodes.map((n) => [n.id, n]));
  const compileChild = (child: ResolvedWorkflow) => buildWorkflowGraph(child, deps).compile();

  const steps: StepEntry[] = [];
  for (const node of topo.nodes) {
    const defer = node.join === "all" && topo.incoming(node.id).length > 1;
    const io = ioSchemas(resolved, node);
    if (entryStep(node) !== node.id) {
      steps.push([entryStep(node), reviewStep(ctx, node, "input", io.input), { defer }]);
    }
    steps.push([
      node.id,
      nodeAction(ctx, node, compileChild),
      { defer: defer && entryStep(node) === node.id },
    ]);
    if (exitStep(node) !== node.id) {
      steps.push([exitStep(node), reviewStep(ctx, node, "output", io.output), {}]);
    }
  }

  const graph = new StateGraph(WorkflowGraphState).addNode(steps);
  for (const node of topo.nodes) {
    if (entryStep(node) !== node.id) graph.addEdge(entryStep(node), node.id);
    if (exitStep(node) !== node.id) graph.addEdge(node.id, exitStep(node));
  }
  for (const id of topo.entries) {
    const node = nodes.get(id);
    if (node) graph.addEdge(START, entryStep(node));
  }
  for (const node of topo.nodes) {
    const outgoing = topo.outgoing(node.id);
    if (outgoing.length === 0) {
      graph.addEdge(exitStep(node), END);
      continue;
    }
    const { route, destinations } = router(outgoing, nodes);
    graph.addConditionalEdges(exitStep(node), route, destinations);
  }
  return graph;
}

function nodeAction(
  ctx: StepContext,
  node: WorkflowNode,
  compileChild: Parameters<typeof subworkflowStep>[2],
): Step {
  switch (node.kind) {
    case "agent":
      return agentStep(ctx, node);
    case "gate":
      return gateStep(ctx, node);
    case "workflow":
      return subworkflowStep(ctx, node, compileChild);
  }
}

/** The schemas a review shows: the target's input before, its output after. */
function ioSchemas(
  resolved: ResolvedWorkflow,
  node: WorkflowNode,
): { input: JsonSchema; output: JsonSchema } {
  const empty: JsonSchema = {};
  if (node.kind === "gate") return { input: empty, output: empty };
  const key = `${node.kind === "agent" ? node.agentId : node.workflowId}@${node.version}`;
  if (node.kind === "agent") {
    const spec = resolved.agents.get(key);
    return { input: spec?.inputSchema ?? empty, output: spec?.outputSchema ?? empty };
  }
  const child = resolved.workflows.get(key)?.document;
  return { input: child?.inputSchema ?? empty, output: child?.outputSchema ?? empty };
}

export { reviewStepName };
