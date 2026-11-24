import { tmpdir } from "node:os";
import type { AgentRuntimeDeps } from "@agentic/agents";
import {
  type AgentSpec,
  defaultToolGuardrails,
  type JsonValue,
  newId,
  type WorkflowDocument,
} from "@agentic/contracts";
import { ProviderRegistry } from "@agentic/llm";
import { type FakeReply, fakeProvider } from "@agentic/testing";
import { McpPool, Toolbox, ToolRegistry } from "@agentic/tools";
import { Command, MemorySaver } from "@langchain/langgraph";
import { buildWorkflowGraph } from "../compiler/compile";
import { refKey } from "../resolve";

/** Agent deps with only the fake provider and an empty toolbox. */
export function testDeps(replies: FakeReply[]) {
  const provider = fakeProvider(replies);
  const deps: AgentRuntimeDeps = {
    providers: new ProviderRegistry().register(provider),
    pricing: async () => undefined,
    scratchDir: tmpdir(),
    tools: new Toolbox({
      registry: new ToolRegistry(),
      pool: new McpPool("test"),
      scratchDir: tmpdir(),
      mcpServers: async () => [],
      skills: async () => [],
      guardrails: async () => defaultToolGuardrails,
      secretValues: () => [],
    }),
  };
  return { deps, provider };
}

/**
 * Compiles a document whose agent nodes pin v1 of the given specs, on an
 * in-memory checkpointer, and runs it on its own thread.
 */
export function compileWorkflow(
  document: WorkflowDocument,
  agents: Record<string, AgentSpec>,
  deps: AgentRuntimeDeps,
) {
  const pinned: WorkflowDocument = {
    ...document,
    nodes: document.nodes.map((n) => (n.kind === "gate" ? n : { ...n, version: 1 })),
  };
  const resolved = {
    document: pinned,
    agents: new Map(Object.entries(agents).map(([id, spec]) => [refKey(id, 1), spec])),
    workflows: new Map(),
  };
  const graph = buildWorkflowGraph(resolved, deps).compile({ checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: newId(), workspace_id: newId() } };
  return {
    graph,
    start: (input: Record<string, JsonValue>) => graph.invoke({ input }, config),
    resume: (answer: unknown) => graph.invoke(new Command({ resume: answer }), config),
    state: () => graph.getState(config),
  };
}
