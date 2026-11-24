import { SESSION_HEADER } from "@agentic/contracts";
import type { GraphRuntime } from "@agentic/graph";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  isTrustedOrigin,
  requireLoopbackHost,
  requireToken,
  requireTrustedOrigin,
} from "./http/auth";
import type { AppEnv } from "./http/env";
import { handleError } from "./http/errors";
import { traceRequests } from "./http/trace";
import type { AgentModule } from "./modules/agents/index";
import { agentRoutes } from "./modules/agents/routes";
import { assistantRoutes } from "./modules/assistants/routes";
import type { AuthModule } from "./modules/auth/index";
import { requireSignedIn, resolvePrincipal } from "./modules/auth/middleware";
import { authRoutes, publicAuthRoutes } from "./modules/auth/routes";
import type { ChatModule } from "./modules/chats/index";
import { chatRoutes } from "./modules/chats/routes";
import type { GithubModule } from "./modules/github/index";
import { githubRoutes } from "./modules/github/routes";
import { healthRoutes } from "./modules/health/routes";
import { inboxRoutes } from "./modules/inbox/routes";
import type { JiraModule } from "./modules/jira/index";
import { jiraRoutes } from "./modules/jira/routes";
import { llmRoutes } from "./modules/llm/routes";
import type { LlmService } from "./modules/llm/service";
import { mcpRoutes } from "./modules/mcp/routes";
import { runRoutes } from "./modules/runs/routes";
import { skillRoutes } from "./modules/skills/routes";
import { terminalRoutes } from "./modules/terminals/routes";
import type { TerminalService } from "./modules/terminals/service";
import { threadRoutes } from "./modules/threads/routes";
import type { ToolModule } from "./modules/tools/index";
import { toolRoutes } from "./modules/tools/routes";
import type { TriggerModule } from "./modules/triggers/index";
import { triggerRoutes } from "./modules/triggers/routes";
import type { WorkflowModule } from "./modules/workflows/index";
import { workflowRoutes } from "./modules/workflows/routes";

export type AppDeps = {
  graph: GraphRuntime;
  llm: LlmService;
  agents: AgentModule;
  workflows: WorkflowModule;
  triggers: TriggerModule;
  chats: ChatModule;
  terminals: TerminalService;
  tools: ToolModule;
  github: GithubModule;
  jira: JiraModule;
  auth: AuthModule;
  token: string;
  version: string;
};

/**
 * The Core HTTP API. Routes are chained so `AppType` carries every path
 * and input for the Hono RPC client in packages/client.
 */
export function createApp({
  graph,
  llm,
  agents,
  workflows,
  triggers,
  chats,
  terminals,
  tools,
  github,
  jira,
  auth,
  token,
  version,
}: AppDeps) {
  const api = new Hono<AppEnv>()
    .use(requireToken(token))
    .route("/auth", publicAuthRoutes(auth.sessions))
    .use(resolvePrincipal(auth.sessions))
    // Registered before `requireSignedIn`, so status works signed out.
    .route("/auth", authRoutes(auth.sessions, auth.members))
    .use(requireSignedIn)
    .route("/assistants", assistantRoutes(graph))
    .route("/threads", threadRoutes(graph))
    .route("/runs", runRoutes(graph))
    .route("/inbox", inboxRoutes(graph))
    .route("/llm", llmRoutes(llm))
    .route("/agents", agentRoutes(agents.service, agents.library))
    .route("/workflows", workflowRoutes(workflows))
    .route("/triggers", triggerRoutes(triggers.service))
    .route("/chats", chatRoutes(chats.service))
    .route("/terminals", terminalRoutes(terminals))
    .route("/tools", toolRoutes(tools.service))
    .route("/mcp", mcpRoutes(tools.mcp))
    .route("/skills", skillRoutes(tools.skills))
    .route("/github", githubRoutes(github.service, github.auth))
    .route("/jira", jiraRoutes(jira.service, jira.auth));

  return (
    new Hono()
      .onError(handleError)
      .use(traceRequests)
      .use(requireLoopbackHost)
      // The token is the security boundary; the origin check only turns
      // away other web pages early. The renderer's origin differs between
      // dev (Vite) and production (file://).
      .use(requireTrustedOrigin)
      .use(
        cors({
          origin: (origin) => (isTrustedOrigin(origin) ? origin : null),
          allowHeaders: ["authorization", "content-type", "x-trace-id", SESSION_HEADER],
          exposeHeaders: ["x-trace-id"],
        }),
      )
      .route("/health", healthRoutes(version))
      .route("/", api)
  );
}

export type AppType = ReturnType<typeof createApp>;
