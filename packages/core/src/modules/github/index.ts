import { GITHUB_SECRETS, type GithubPull, type ToolGuardrails } from "@agentic/contracts";
import type { Database } from "@agentic/db";
import { GithubConnection, githubReadTools, githubWriteTools } from "@agentic/integrations";
import type { ToolRegistry } from "@agentic/tools";
import type { SecretStore } from "../../runtime/secret-store";
import { githubAppTools } from "./app-tools";
import { GithubAuthService } from "./auth-service";
import { GithubService } from "./service";
import { GithubSettingsRepository } from "./settings-repository";
import { WorktreeService } from "./worktrees";

export type GithubModuleDeps = {
  db: Database;
  /** `<dataDir>/git`: clones and run worktrees. */
  gitRoot: string;
  scratchDir: string;
  version: string;
  secrets: SecretStore;
  registry: ToolRegistry;
  guardrails(workspaceId: string): Promise<ToolGuardrails>;
  /** api.github.com unless overridden (GitHub Enterprise, a local stand-in). */
  apiUrl?: string;
  /** After a PR is opened (by an agent or the UI): links it on the Jira issues it names. */
  onPullOpened?(workspaceId: string, repo: string, pull: GithubPull): Promise<unknown>;
  /** Hands a token from device sign-in to main for the vault (headless: memory only). */
  storeSecret?(name: string, value: string): void;
};

/** The web host behind an API URL: api.github.com → github.com, GHE `/api/v3` → its host. */
export function webUrlOf(apiUrl: string | undefined): string {
  if (!apiUrl) return "https://github.com";
  const url = new URL(apiUrl);
  if (url.hostname === "api.github.com") return "https://github.com";
  return `${url.origin}${url.pathname.replace(/\/api\/v3\/?$/, "").replace(/\/$/, "")}`;
}

/**
 * Wires GitHub: one connection (vault token, else `gh auth`), its tools on
 * the shared registry, App tools for chat, run worktrees, and the views.
 */
export function createGithubModule(deps: GithubModuleDeps) {
  const webUrl = webUrlOf(deps.apiUrl);
  const gitHost = new URL(webUrl).host;
  const conn = new GithubConnection({
    vaultToken: () => deps.secrets.get(GITHUB_SECRETS.token),
    baseUrl: deps.apiUrl,
    userAgent: `agentic-hub/${deps.version}`,
  });
  deps.registry.register(
    ...githubReadTools(conn),
    ...githubWriteTools(conn, gitHost, deps.onPullOpened),
  );
  const auth = new GithubAuthService(
    conn,
    new GithubSettingsRepository(deps.db),
    webUrl,
    async (token) => {
      deps.secrets.set(GITHUB_SECRETS.token, token);
      deps.storeSecret?.(GITHUB_SECRETS.token, token);
    },
  );
  const worktrees = new WorktreeService({
    conn,
    gitHost,
    root: deps.gitRoot,
    scratchDir: deps.scratchDir,
    guardrails: deps.guardrails,
  });
  return {
    conn,
    auth,
    worktrees,
    service: new GithubService(conn, deps.onPullOpened),
    appTools: githubAppTools(conn),
    close: async () => auth.stop(),
  };
}

export type GithubModule = ReturnType<typeof createGithubModule>;
