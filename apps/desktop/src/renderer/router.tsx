import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { RouteError } from "./components/route-error";
import { isFirstRunDone } from "./lib/first-run";
import { registerNavigate } from "./lib/navigate";
import { AgentEditorPage } from "./routes/agents/editor/page";
import { AgentsPage } from "./routes/agents/page";
import { ChatPage } from "./routes/chats/chat-page";
import { ChatsLayout } from "./routes/chats/layout";
import { NewChatPage } from "./routes/chats/new-chat-page";
import { GithubPage } from "./routes/github/page";
import { InboxPage } from "./routes/inbox/page";
import { JiraPage } from "./routes/jira/page";
import { PlaceholderPage } from "./routes/placeholder-page";
import { RunsPage } from "./routes/runs/page";
import { AccountPage } from "./routes/settings/account/page";
import { DatabasePage } from "./routes/settings/database/page";
import { GeneralSettingsPage } from "./routes/settings/general-page";
import { GithubSettingsPage } from "./routes/settings/github/page";
import { JiraSettingsPage } from "./routes/settings/jira/page";
import { SettingsLayout } from "./routes/settings/layout";
import { LogsPage } from "./routes/settings/logs/page";
import { logSearchSchema } from "./routes/settings/logs/search";
import { McpPage } from "./routes/settings/mcp/page";
import { ProvidersPage } from "./routes/settings/providers/page";
import { SecretsPage } from "./routes/settings/secrets/page";
import { SkillsPage } from "./routes/settings/skills/page";
import { ToolsPage } from "./routes/settings/tools/page";
import { WelcomePage } from "./routes/welcome/page";
import { CompareRunsPage } from "./routes/workflows/compare/page";
import { WorkflowEditorPage } from "./routes/workflows/editor/page";
import { WorkflowsPage } from "./routes/workflows/page";
import { WorkflowRunPage } from "./routes/workflows/run-view/page";
import { AppLayout } from "./shell/app-layout";
import { navItems } from "./shell/nav-items";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // The app opens on "/": first-run setup until it is finished or skipped (P18.6).
  beforeLoad: () => {
    throw redirect({ to: isFirstRunDone() ? "/chats" : "/welcome" });
  },
});

const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  component: WelcomePage,
});

/** Feature pages that have landed; the rest show their empty state until their phase. */
const pages: Partial<Record<string, () => React.JSX.Element>> = {
  "/agents": AgentsPage,
  "/workflows": WorkflowsPage,
  "/runs": RunsPage,
  "/inbox": InboxPage,
  "/github": GithubPage,
  "/jira": JiraPage,
};

const featureRoutes = navItems
  .filter((item) => item.path !== "/chats")
  .map((item) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: item.path,
      component: pages[item.path] ?? (() => <PlaceholderPage item={item} />),
    }),
  );

const chatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chats",
  component: ChatsLayout,
});
const newChatRoute = createRoute({
  getParentRoute: () => chatsRoute,
  path: "/",
  component: NewChatPage,
});
const chatRoute = createRoute({
  getParentRoute: () => chatsRoute,
  path: "/$chatId",
  component: ChatPage,
});

const agentEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agents/$agentId",
  component: AgentEditorPage,
});

const workflowEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows/$workflowId",
  component: WorkflowEditorPage,
});
const workflowRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows/$workflowId/runs/$runId",
  component: WorkflowRunPage,
});
const compareRunsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows/$workflowId/compare/$a/$b",
  component: CompareRunsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsLayout,
});
const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: GeneralSettingsPage,
});
const accountRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/account",
  component: AccountPage,
});
const databaseRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/database",
  component: DatabasePage,
});
const providersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/providers",
  component: ProvidersPage,
});
const toolsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/tools",
  component: ToolsPage,
});
const mcpRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/mcp",
  component: McpPage,
});
const skillsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/skills",
  component: SkillsPage,
});
const githubSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/github",
  component: GithubSettingsPage,
});
const jiraSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/jira",
  component: JiraSettingsPage,
});
const secretsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/secrets",
  component: SecretsPage,
});

const logsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/logs",
  component: LogsPage,
  validateSearch: (search) => logSearchSchema.parse(search),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  welcomeRoute,
  ...featureRoutes,
  chatsRoute.addChildren([newChatRoute, chatRoute]),
  agentEditorRoute,
  workflowEditorRoute,
  workflowRunRoute,
  compareRunsRoute,
  settingsRoute.addChildren([
    settingsIndexRoute,
    accountRoute,
    databaseRoute,
    providersRoute,
    toolsRoute,
    mcpRoute,
    skillsRoute,
    githubSettingsRoute,
    jiraSettingsRoute,
    secretsRoute,
    logsRoute,
  ]),
]);

// Hash history works for both the dev server and file:// in production.
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: RouteError,
});

registerNavigate((to, search) => void router.navigate({ to, search }));

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
