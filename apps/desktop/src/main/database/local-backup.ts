import { basename } from "node:path";
import { AppError, type DatabaseStatus } from "@agentic/contracts";
import { moduleLogger } from "@agentic/logger";
import { app, BrowserWindow, dialog } from "electron";
import type { DatabaseSupervisor } from "./database-supervisor";
import type { LocalService } from "./local-service";

const log = moduleLogger("main.backup");
const filters = [{ name: "Agentic Hub database backup", extensions: ["gz"] }];

/** Settings → Database → Back up: pick a file, then snapshot the stopped cluster (P18.2). */
export async function backupFromDialog(
  database: DatabaseSupervisor,
  local: LocalService,
): Promise<{ path: string | null; bytes: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const options: Electron.SaveDialogOptions = {
    title: "Back up the local database",
    defaultPath: `${app.getPath("documents")}/agentic-backup-${day}.tar.gz`,
    filters,
  };
  const window = BrowserWindow.getFocusedWindow();
  const picked = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  if (picked.canceled || !picked.filePath) return { path: null, bytes: 0 };
  const path = picked.filePath;
  const { result } = await database.withLocalStopped(() => local.backup(path));
  log.info({ bytes: result.bytes }, "local database backed up");
  return { path, bytes: result.bytes };
}

/**
 * Settings → Database → Restore: pick a backup, confirm, swap it in, and
 * put the old cluster back if the restored one doesn't start.
 */
export async function restoreFromDialog(
  database: DatabaseSupervisor,
  local: LocalService,
): Promise<{ restored: boolean; status: DatabaseStatus }> {
  const file = await pickBackup();
  if (!file) return { restored: false, status: await database.status() };
  const { result: previous, status } = await database.withLocalStopped(() => local.restore(file));
  if (status.state !== "error") {
    log.info({ previous }, "local database restored");
    return { restored: true, status };
  }
  log.error({ error: status.error }, "restored database did not start; rolling back");
  await database.withLocalStopped(() => local.rollbackRestore(previous));
  throw new AppError(
    "unavailable",
    `The backup didn't start (${status.error ?? "unknown error"}). Your previous database is back.`,
  );
}

async function pickBackup(): Promise<string | undefined> {
  const window = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: "Restore the local database",
    properties: ["openFile"],
    filters,
  };
  const picked = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  const file = picked.canceled ? undefined : picked.filePaths[0];
  if (!file) return undefined;
  const confirm: Electron.MessageBoxOptions = {
    type: "warning",
    message: "Replace the local database?",
    detail: `Agentic Hub restarts on the backup in ${basename(file)}. Changes made since that backup are replaced. The current database is kept next to it (postgres/data.before-restore) until the next restore.`,
    buttons: ["Restore", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  };
  const answer = window
    ? await dialog.showMessageBox(window, confirm)
    : await dialog.showMessageBox(confirm);
  return answer.response === 0 ? file : undefined;
}
