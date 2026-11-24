import type { AgentRuntimeDeps } from "@agentic/agents";
import type { Database } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import type { AgentModule } from "../agents/index";
import type { BundleTools } from "./bundle-capabilities";
import { WorkflowDirectory } from "./directory";
import { WorkflowLibrary } from "./library";
import { WorkflowReferences } from "./references";
import { WorkflowRepository } from "./repository";
import { WorkflowRunner } from "./runner";
import { WorkflowService } from "./service";
import { WorkflowAssistantSource } from "./source";

export type WorkflowModuleDeps = {
  db: Database;
  graph: GraphRuntime;
  agents: AgentModule;
  runtime: AgentRuntimeDeps;
  /** Skills and MCP servers that bundles bring along. */
  tools: BundleTools;
};

/**
 * Wires the workflows module and the assistant source that lets the
 * LangGraph host run published versions and draft snapshots.
 */
export function createWorkflowModule({ db, graph, agents, runtime, tools }: WorkflowModuleDeps) {
  const repo = new WorkflowRepository(db);
  const refs = new WorkflowReferences(agents.directory, repo);
  graph.registry.addSource(new WorkflowAssistantSource(repo, refs, runtime));
  const service = new WorkflowService(repo, refs);
  return {
    service,
    runner: new WorkflowRunner(service, graph),
    library: new WorkflowLibrary(service, agents, tools),
    directory: new WorkflowDirectory(repo, refs),
  };
}

export type WorkflowModule = ReturnType<typeof createWorkflowModule>;
