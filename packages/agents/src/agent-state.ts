import type { AgentRunReport, AgentSpec, JsonValue, ModelRef } from "@agentic/contracts";
import { Annotation } from "@langchain/langgraph";

/**
 * The state of an agent run: the run input (`input`, optional `model`
 * override, and the `spec` snapshot of a draft run), then what the node
 * produced. One node, so every channel is last-write-wins.
 */
export const AgentState = Annotation.Root({
  input: Annotation<Record<string, JsonValue>>(),
  model: Annotation<ModelRef | undefined>(),
  spec: Annotation<AgentSpec | undefined>(),
  output: Annotation<Record<string, unknown> | undefined>(),
  report: Annotation<AgentRunReport | undefined>(),
});
export type AgentStateValues = typeof AgentState.State;
export type AgentStateUpdate = typeof AgentState.Update;

/** The node name every agent graph uses ("write as node" in the StateInspector). */
export const AGENT_NODE = "agent";
