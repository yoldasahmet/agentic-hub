import type { AgentRuntimeDeps } from "@agentic/agents";
import type { Database } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import type { SkillService } from "../skills/service";
import { AgentDirectory } from "./directory";
import { AgentLibrary } from "./library";
import { AgentRepository } from "./repository";
import { AgentService } from "./service";
import { AgentAssistantSource } from "./source";
import { TestInputRepository } from "./test-inputs";

export type AgentModuleDeps = AgentRuntimeDeps & {
  db: Database;
  graph: GraphRuntime;
  /** Built-in agents bring the built-in skills they name. */
  skills: SkillService;
};

/**
 * Wires the agents module: its repository and services, and the assistant
 * source that lets the LangGraph host run agent versions and drafts.
 */
export function createAgentModule({ db, graph, skills, ...runtime }: AgentModuleDeps) {
  const repo = new AgentRepository(db);
  const deps: AgentRuntimeDeps = runtime;
  graph.registry.addSource(new AgentAssistantSource(repo, deps));
  const service = new AgentService(repo, new TestInputRepository(db), graph);
  return {
    service,
    library: new AgentLibrary(service, skills),
    directory: new AgentDirectory(repo),
    /** What agent nodes run with, shared by workflows. */
    runtime: deps,
  };
}

export type AgentModule = ReturnType<typeof createAgentModule>;
