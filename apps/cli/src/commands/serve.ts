import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "../args";
import { dim, print, printJson } from "../output";
import { cliVersion } from "../version";

export const serveUsage = `agentic serve [--data-dir DIR] [--json]
  Runs Core headless under Node until SIGINT/SIGTERM. Configure it with
  AGENTIC_DATABASE_URL (required), AGENTIC_DB_TLS, AGENTIC_DATA_DIR,
  AGENTIC_OPENROUTER_API_KEY, AGENTIC_GITHUB_API_URL, and
  AGENTIC_SECRET_{MCP_<NAME>,GITHUB_TOKEN,JIRA_TOKEN}.`;

/**
 * Core under plain Node (scripts, CI, a future worker). It writes the same
 * runtime file the app does, so every other command finds it.
 */
export async function serveCommand(rest: string[]): Promise<number> {
  const { values } = parse(rest, {});
  const env = { ...process.env };
  if (values["data-dir"]) env.AGENTIC_DATA_DIR = values["data-dir"];
  // Loaded only here: the other commands never pay for the whole backend.
  const { startHeadlessCore, stopOnSignals } = await import("@agentic/core");
  const core = await startHeadlessCore(env, cliVersion, { migrationsFolder: bundledMigrations() });
  stopOnSignals(core);
  if (values.json) printJson({ url: core.info.url, pid: core.info.pid });
  else print(`Core listening on ${core.info.url} ${dim(`(pid ${core.info.pid}, Ctrl-C stops)`)}`);
  // Keep running: Core's server holds the event loop open.
  return new Promise<number>(() => {});
}

/** The packaged CLI (apps/cli/scripts/bundle.mjs) has `migrations/` next to it; source runs use packages/db's. */
function bundledMigrations(): string | undefined {
  const folder = fileURLToPath(new URL("./migrations", import.meta.url));
  return existsSync(folder) ? folder : undefined;
}
