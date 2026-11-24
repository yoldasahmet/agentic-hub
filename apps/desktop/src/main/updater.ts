import { existsSync } from "node:fs";
import { join } from "node:path";
import { moduleLogger } from "@agentic/logger";
import { app, BrowserWindow, dialog, type MessageBoxOptions } from "electron";
import updater from "electron-updater";

const log = moduleLogger("main.updater");
const { autoUpdater } = updater;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Packaged macOS builds only: dev has no release to compare against. */
const enabled = () =>
  app.isPackaged &&
  process.platform === "darwin" &&
  existsSync(join(process.resourcesPath, "app-update.yml"));

/**
 * Auto-update from GitHub Releases (P18.4, electron-builder.yml `publish`).
 * Updates download in the background and install when the app quits;
 * Squirrel.Mac only accepts them when the app is signed (P18.3).
 */
export function startAutoUpdates(): void {
  if (!enabled()) return;
  autoUpdater.logger = {
    info: (message: unknown) => log.info({ detail: String(message) }, "updater"),
    warn: (message: unknown) => log.warn({ detail: String(message) }, "updater"),
    error: (message: unknown) => log.error({ detail: String(message) }, "updater"),
    debug: (message: unknown) => log.debug({ detail: String(message) }, "updater"),
  };
  autoUpdater.on("update-downloaded", (info) => {
    log.info({ version: info.version }, "update ready; installs on quit");
  });
  const check = () =>
    void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
      log.warn({ err }, "update check failed");
    });
  check();
  setInterval(check, CHECK_EVERY_MS).unref();
}

/** App menu → "Check for Updates…": the same check, with an answer either way. */
export async function checkForUpdatesFromMenu(): Promise<void> {
  if (!enabled()) {
    await show({ type: "info", message: "This build has no update feed." });
    return;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo.version;
    const newer = result?.isUpdateAvailable === true;
    await show({
      type: "info",
      message: newer ? `Agentic Hub ${latest} is downloading` : "Agentic Hub is up to date",
      detail: newer
        ? "It installs the next time you quit Agentic Hub."
        : `You have version ${app.getVersion()}.`,
    });
  } catch (err) {
    log.warn({ err }, "update check failed");
    await show({
      type: "error",
      message: "Couldn't check for updates",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

async function show(options: MessageBoxOptions): Promise<void> {
  const window = BrowserWindow.getFocusedWindow();
  if (window) await dialog.showMessageBox(window, options);
  else await dialog.showMessageBox(options);
}
