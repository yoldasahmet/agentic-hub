import { release } from "node:os";
import { PRODUCT_NAME } from "@agentic/contracts";
import { readLogs, redactValue } from "@agentic/logger";
import { app } from "electron";
import type { CoreSupervisor } from "../core/core-supervisor";
import type { DatabaseSupervisor } from "../database/database-supervisor";
import type { Vault } from "../vault/vault";

type Deps = { vault: Vault; database: DatabaseSupervisor; core: CoreSupervisor; logDir: string };

/**
 * A support bundle for a bug report: versions, DB/Core/vault status, and
 * recent logs from main and Core. Core's URL and token are left out and
 * the whole bundle is redacted again, so it is safe to paste anywhere.
 */
export async function buildDiagnostics(deps: Deps): Promise<{ text: string; entries: number }> {
  const core = deps.core.status();
  const [database, vault, problems, recent] = await Promise.all([
    deps.database.status(),
    deps.vault.status(),
    readLogs(deps.logDir, { level: "warn", limit: 100 }),
    readLogs(deps.logDir, { level: "info", limit: 300 }),
  ]);
  const bundle = {
    generatedAt: new Date().toISOString(),
    app: {
      name: PRODUCT_NAME,
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      osRelease: release(),
    },
    database,
    core: { state: core.state, restarts: core.restarts, error: core.error },
    vault,
    logDir: deps.logDir,
    problems: problems.entries,
    recent: recent.entries,
  };
  const text = JSON.stringify(redactValue(bundle), null, 2);
  return { text, entries: problems.entries.length + recent.entries.length };
}
