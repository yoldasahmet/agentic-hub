import { CHAT_ASSISTANT_ID } from "@agentic/contracts";
import type { AssistantDefinition } from "@agentic/graph";
import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatDeps } from "./deps";
import { appNode } from "./nodes/app";
import { askNode } from "./nodes/ask";
import { executeNode } from "./nodes/execute";
import { intakeNode } from "./nodes/intake";
import { respondNode } from "./nodes/respond";
import { CHAT_NODES, ChatState } from "./state";

const { intake, ask, execute, respond, app } = CHAT_NODES;

/**
 * The chat orchestrator: intake → (ask ⟲) → execute → respond for agents
 * and workflows, and the App assistant, which may hand its turn to one.
 * Routing nodes return a `Command`, so their destinations are declared.
 */
export function buildChatGraph(deps: ChatDeps) {
  return new StateGraph(ChatState)
    .addNode(intake, intakeNode(deps), { ends: [app, ask, execute] })
    .addNode(ask, askNode(deps), { ends: [ask, intake, execute, END] })
    .addNode(app, appNode(deps), { ends: [ask, execute, END] })
    .addNode(execute, executeNode(deps))
    .addNode(respond, respondNode(deps))
    .addEdge(START, intake)
    .addEdge(execute, respond)
    .addEdge(respond, END);
}

/** The built-in `chat` assistant. Targets are data in each run's context, so one version serves all. */
export function chatAssistant(deps: ChatDeps): AssistantDefinition {
  return {
    id: CHAT_ASSISTANT_ID,
    name: "Chat",
    description: "Chats with the App, an agent, or a workflow",
    version: 1,
    nodes: Object.values(CHAT_NODES),
    build: (graphDeps) => buildChatGraph(deps).compile(graphDeps),
  };
}
