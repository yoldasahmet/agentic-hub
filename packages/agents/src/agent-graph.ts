import { type AgentSpec, AppError, agentRunStateInputSchema } from "@agentic/contracts";
import type { GraphDeps, RunnableGraph } from "@agentic/graph";
import { checkJsonSchema } from "@agentic/llm";
import { END, type LangGraphRunnableConfig, START, StateGraph } from "@langchain/langgraph";
import {
  AGENT_NODE,
  AgentState,
  type AgentStateUpdate,
  type AgentStateValues,
} from "./agent-state";
import type { AgentRuntimeDeps } from "./deps";
import { runHumanAgent } from "./nodes/human-node";
import { runLlmAgent } from "./nodes/llm-node";
import { runToolAgent } from "./nodes/tool-node";

/** A published version closes over its spec; a draft run reads the snapshot from its state. */
export type SpecSource = (state: AgentStateValues) => AgentSpec;

/**
 * One agent as a one-node LangGraph graph. The node is generic: what it
 * does comes from the spec's kind, prompt, schemas, and runtime (R7).
 * Workflows reuse `agentNode` as a node of a larger graph (P7.6).
 */
export function buildAgentGraph(
  specOf: SpecSource,
  deps: AgentRuntimeDeps,
  graphDeps: GraphDeps,
): RunnableGraph {
  return agentStateGraph(specOf, deps).compile(graphDeps);
}

/**
 * The same graph without a checkpointer, to run inside a node of another
 * graph (chat). It shares that thread, so its gates pause the outer run.
 */
export function agentSubgraph(spec: AgentSpec, deps: AgentRuntimeDeps) {
  return agentStateGraph(() => spec, deps).compile();
}

function agentStateGraph(specOf: SpecSource, deps: AgentRuntimeDeps) {
  return new StateGraph(AgentState)
    .addNode(AGENT_NODE, agentNode(specOf, deps))
    .addEdge(START, AGENT_NODE)
    .addEdge(AGENT_NODE, END);
}

export function agentNode(specOf: SpecSource, deps: AgentRuntimeDeps) {
  return async (
    state: AgentStateValues,
    config: LangGraphRunnableConfig,
  ): Promise<AgentStateUpdate> => {
    const spec = specOf(state);
    const { input, model } = agentRunStateInputSchema.parse({
      input: state.input ?? {},
      model: state.model,
    });
    const checked = checkJsonSchema(spec.inputSchema, input);
    if (!checked.ok) {
      throw new AppError("validation_failed", "The inputs don't match the agent's input schema", {
        issues: checked.issues,
      });
    }
    switch (spec.kind) {
      case "llm":
        return runLlmAgent(spec, input, model, deps, config);
      case "human":
        return runHumanAgent(spec, input);
      case "tool":
        return runToolAgent(spec, input, deps, config);
    }
  };
}
