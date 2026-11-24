import {
  dbConnectionStringSchema,
  dbTlsModeSchema,
  PROVIDER_SECRETS,
  secretValueSchema,
} from "@agentic/contracts";
import { type CoreInstance, startCore } from "./core";
import { startCoreLogging } from "./runtime/logging";
import { defaultHeadlessDataDir } from "./runtime/paths";

export type HeadlessEnv = Record<string, string | undefined>;

/** The bundled CLI ships the SQL migrations next to itself (P18.7). */
export type HeadlessOptions = { migrationsFolder?: string };

/**
 * Core under plain Node, configured from the environment (`pnpm --filter
 * @agentic/core start` and `agentic serve`): AGENTIC_DATABASE_URL,
 * AGENTIC_DB_TLS (default verify-full), AGENTIC_DATA_DIR, and optionally
 * AGENTIC_OPENROUTER_API_KEY, AGENTIC_OPENROUTER_BASE_URL, and
 * AGENTIC_GITHUB_API_URL. MCP, GitHub, and Jira secrets come as
 * AGENTIC_SECRET_MCP_<NAME> / AGENTIC_SECRET_GITHUB_TOKEN /
 * AGENTIC_SECRET_JIRA_TOKEN (`mcp.<name>`, `github.token`, `jira.token`:
 * lowercased, `_` → `.`), since there is no vault here. Without a GitHub
 * token, an existing `gh auth login` is used. The Jira site and email are
 * workspace settings (PUT /jira/settings). Logs go to AGENTIC_LOG_DIR
 * (default `<dataDir>/logs`) at AGENTIC_LOG_LEVEL, and from info up to stderr.
 */
export async function startHeadlessCore(
  env: HeadlessEnv,
  version: string,
  options: HeadlessOptions = {},
): Promise<CoreInstance> {
  const connectionString = dbConnectionStringSchema.parse(env.AGENTIC_DATABASE_URL);
  const tls = dbTlsModeSchema.parse(env.AGENTIC_DB_TLS ?? "verify-full");
  const dataDir = env.AGENTIC_DATA_DIR ?? defaultHeadlessDataDir();
  startCoreLogging({ logDir: env.AGENTIC_LOG_DIR, dataDir, env, console: "info" });
  const openRouterKey = secretValueSchema.optional().parse(env.AGENTIC_OPENROUTER_API_KEY);
  const secrets: Record<string, string> = {};
  if (openRouterKey) secrets[PROVIDER_SECRETS.openrouterApiKey] = openRouterKey;
  for (const [key, value] of Object.entries(env)) {
    if (/^AGENTIC_SECRET_(MCP|GITHUB|JIRA)_/.test(key) && value) {
      secrets[key.slice("AGENTIC_SECRET_".length).toLowerCase().replaceAll("_", ".")] = value;
    }
  }
  return startCore(
    {
      db: { mode: "remote", connectionString, tls },
      dataDir,
      secrets,
      migrationsFolder: options.migrationsFolder,
    },
    {
      version,
      openRouterBaseUrl: env.AGENTIC_OPENROUTER_BASE_URL,
      githubApiUrl: env.AGENTIC_GITHUB_API_URL,
    },
  );
}

/** Stops Core on SIGINT/SIGTERM, then exits. */
export function stopOnSignals(core: CoreInstance): void {
  const shutdown = () => void core.stop().finally(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
