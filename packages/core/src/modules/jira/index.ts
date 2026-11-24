import { type GithubPull, JIRA_SECRETS } from "@agentic/contracts";
import type { Database } from "@agentic/db";
import {
  JiraConnection,
  jiraReadTools,
  jiraWriteTools,
  linkPullToJira,
} from "@agentic/integrations";
import type { ToolRegistry } from "@agentic/tools";
import type { SecretStore } from "../../runtime/secret-store";
import { jiraAppTools } from "./app-tools";
import { JiraAuthService } from "./auth-service";
import { JiraService } from "./service";
import { JiraSettingsRepository } from "./settings-repository";

export type JiraModuleDeps = {
  db: Database;
  version: string;
  secrets: SecretStore;
  registry: ToolRegistry;
};

/**
 * Wires Jira: one connection per workspace (its site and email, the vault's
 * API token), its tools on the shared registry, App tools for chat, the
 * views, and the PR → issue linker GitHub calls after opening a PR.
 */
export function createJiraModule(deps: JiraModuleDeps) {
  const settings = new JiraSettingsRepository(deps.db);
  const conn = new JiraConnection({
    token: () => deps.secrets.get(JIRA_SECRETS.token),
    settings: (workspaceId) => settings.get(workspaceId),
    userAgent: `agentic-hub/${deps.version}`,
  });
  deps.registry.register(...jiraReadTools(conn), ...jiraWriteTools(conn));
  return {
    conn,
    auth: new JiraAuthService(conn, settings),
    service: new JiraService(conn),
    appTools: jiraAppTools(conn),
    linkPull: (workspaceId: string, repo: string, pull: GithubPull) =>
      linkPullToJira(conn, workspaceId, { ...pull, repo }).catch(() => []),
  };
}

export type JiraModule = ReturnType<typeof createJiraModule>;
