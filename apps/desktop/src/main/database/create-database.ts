import { join } from "node:path";
import { isIntegrationSecret } from "@agentic/contracts";
import { app, BrowserWindow } from "electron";
import { CoreSupervisor } from "../core/core-supervisor";
import { loadProviderSecrets } from "../core/provider-secrets";
import { sendEvent } from "../ipc/send";
import type { Vault } from "../vault/vault";
import { DatabaseSettingsFile } from "./database-settings";
import { DatabaseSupervisor } from "./database-supervisor";
import { LocalService } from "./local-service";

/** Wires the DB and Core supervisors to app paths and pushes their status to every window. */
export function createDatabase(
  vault: Vault,
  logDir: string,
): {
  database: DatabaseSupervisor;
  local: LocalService;
  core: CoreSupervisor;
} {
  const userData = app.getPath("userData");
  const local = new LocalService({
    vault,
    rootDir: join(userData, "postgres"),
    // electron-builder.yml copies the arch's binaries to Resources/postgres (P18.2).
    binDir: app.isPackaged ? join(process.resourcesPath, "postgres", "bin") : undefined,
    onUnexpectedExit: (reason) => database.handleLocalExit(reason),
  });
  const core = new CoreSupervisor({
    // electron.vite.config.ts bundles packages/core into out/main/core.js.
    entry: join(import.meta.dirname, "core.js"),
    version: app.getVersion(),
    onRestarted: (ready) => void database.ready(ready),
    loadSecrets: () => loadProviderSecrets(vault),
    // Only integration tokens (a GitHub device sign-in) may be written by Core.
    storeSecret: async (name, value) => {
      if (isIntegrationSecret(name)) await vault.set(name, value);
    },
  });
  const database = new DatabaseSupervisor({
    vault,
    local,
    core,
    settings: new DatabaseSettingsFile(join(userData, "database.json")),
    dataDir: userData,
    logDir,
    // electron.vite.config.ts copies packages/db/drizzle next to the main bundle.
    migrationsFolder: join(import.meta.dirname, "migrations"),
  });
  database.onStatus((status) => broadcast((win) => sendEvent(win, "database.status", status)));
  core.onStatus((status) => broadcast((win) => sendEvent(win, "core.status", status)));
  return { database, local, core };
}

function broadcast(send: (win: BrowserWindow) => void): void {
  for (const win of BrowserWindow.getAllWindows()) send(win);
}
