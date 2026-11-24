import {
  AppError,
  AUTH_SESSION_SECRET,
  isCoreSecret,
  isManagedSecret,
  PRODUCT_NAME,
  type SecretName,
  sessionTokenSchema,
} from "@agentic/contracts";
import { app } from "electron";
import { showAttention } from "../attention";
import type { CoreSupervisor } from "../core/core-supervisor";
import type { DatabaseSupervisor } from "../database/database-supervisor";
import { backupFromDialog, restoreFromDialog } from "../database/local-backup";
import type { LocalService } from "../database/local-service";
import { openDirectory, openFiles } from "../dialogs";
import { registerLogHandlers } from "../logs/register-log-handlers";
import type { Vault } from "../vault/vault";
import { handle } from "./handle";

type Deps = {
  vault: Vault;
  database: DatabaseSupervisor;
  local: LocalService;
  core: CoreSupervisor;
  logDir: string;
};

/** Every IPC channel in `ipcChannels` is implemented here. */
export function registerIpcHandlers({ vault, database, local, core, logDir }: Deps): void {
  handle("app.info", () => ({
    name: PRODUCT_NAME,
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));
  handle("secrets.status", () => vault.status());
  handle("secrets.list", () => vault.list());
  // Core keeps provider keys and MCP secrets in memory, so a change is pushed to it right away.
  const syncCore = async (name: SecretName) => {
    if (isCoreSecret(name)) await core.refreshSecrets();
  };
  handle("secrets.set", async ({ name, value }) => {
    const meta = await vault.set(assertUserSecret(name), value);
    await syncCore(name);
    return meta;
  });
  handle("secrets.delete", async ({ name }) => {
    const deleted = await vault.delete(assertUserSecret(name));
    await syncCore(name);
    return { deleted };
  });
  handle("database.status", () => database.status());
  handle("database.test", (target) => database.test(target));
  handle("database.switch", (target) => database.switchTo(target));
  handle("database.migrate", () => database.migrate());
  handle("database.backup", () => backupFromDialog(database, local));
  handle("database.restore", () => restoreFromDialog(database, local));
  handle("core.status", () => core.status());
  handle("auth.session", async () => {
    const stored = sessionTokenSchema.safeParse(await vault.get(AUTH_SESSION_SECRET));
    return { token: stored.success ? stored.data : null };
  });
  handle("auth.setSession", async ({ token }) => {
    if (token) await vault.set(AUTH_SESSION_SECRET, token);
    else await vault.delete(AUTH_SESSION_SECRET);
    return { ok: true };
  });
  handle("app.attention", (input) => showAttention(input));
  handle("dialog.openFiles", () => openFiles());
  handle("dialog.openDirectory", ({ defaultPath }) => openDirectory(defaultPath));
  registerLogHandlers({ vault, database, core, logDir });
}

function assertUserSecret(name: SecretName): SecretName {
  if (isManagedSecret(name)) {
    throw new AppError("forbidden", `${name} is managed by the app. Change it in its settings.`);
  }
  return name;
}
