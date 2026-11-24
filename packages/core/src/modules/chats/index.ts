import type { AgentRuntimeDeps } from "@agentic/agents";
import { type AppTool, chatAssistant } from "@agentic/chat";
import type { Database } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import type { AgentModule } from "../agents/index";
import type { LlmService } from "../llm/service";
import type { WorkflowModule } from "../workflows/index";
import { ChatRepository } from "./repository";
import { ChatService } from "./service";
import { ChatTargetDirectory } from "./targets";

export type ChatModuleDeps = {
  db: Database;
  graph: GraphRuntime;
  agents: AgentModule;
  workflows: WorkflowModule;
  llm: LlmService;
  runtime: AgentRuntimeDeps;
  /** App tools from integrations (GitHub, Jira) as they land. */
  tools?: AppTool[];
};

/**
 * Wires chats: the built-in `chat` assistant (one graph for every target,
 * which it reads from each run's context) and the chats service.
 */
export function createChatModule({
  db,
  graph,
  agents,
  workflows,
  llm,
  runtime,
  tools = [],
}: ChatModuleDeps) {
  const targets = new ChatTargetDirectory(agents.directory, workflows.directory, runtime);
  graph.registry.register(
    chatAssistant({
      providers: runtime.providers,
      pricing: runtime.pricing,
      defaultModel: (workspaceId) => llm.defaultModel(workspaceId),
      targets,
      tools,
      scratchDir: runtime.scratchDir,
    }),
  );
  return {
    service: new ChatService(new ChatRepository(db), graph, targets, (workspaceId, dir) =>
      runtime.tools.checkDir(workspaceId, dir),
    ),
  };
}

export type ChatModule = ReturnType<typeof createChatModule>;
