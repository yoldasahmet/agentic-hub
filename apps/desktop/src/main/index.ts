import { isAbsolute, join } from "node:path";
import { PRODUCT_NAME } from "@agentic/contracts";
import { app, BrowserWindow } from "electron";
import { createDatabase } from "./database/create-database";
import { registerIpcHandlers } from "./ipc/register-handlers";
import { startMainLogging } from "./logging";
import { installAppMenu } from "./menu";
import { installSecurityGuards } from "./security";
import { startAutoUpdates } from "./updater";
import { Vault } from "./vault/vault";
import { createMainWindow } from "./window/create-window";

// Electron uses its internal name for the profile and the macOS Keychain service.
app.setName("Agentic");

// A separate profile (data, vault, local DB) for E2E runs and side-by-side instances.
const userDataDir = process.env.AGENTIC_USER_DATA_DIR;
if (userDataDir && isAbsolute(userDataDir)) app.setPath("userData", userDataDir);

// One app instance owns the local Postgres service and Core (Phases 3–4).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  installSecurityGuards();

  void app.whenReady().then(async () => {
    const logDir = startMainLogging();
    const vault = new Vault(join(app.getPath("userData"), "vault.json"), !app.isPackaged);
    const { database, local, core } = createDatabase(vault, logDir);
    registerIpcHandlers({ vault, database, local, core, logDir });
    app.setAboutPanelOptions({ applicationName: PRODUCT_NAME });
    installAppMenu();
    stopOnQuit(() => database.stop());
    // The window opens right away; the DB and Core report progress through their status.
    void database.start();
    await createMainWindow();
    startAutoUpdates();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

/** Holds the quit until `cleanup` finishes, so the local Postgres shuts down cleanly. */
function stopOnQuit(cleanup: () => Promise<void>): void {
  let done = false;
  app.on("before-quit", (event) => {
    if (done) return;
    event.preventDefault();
    void cleanup()
      .catch(() => undefined)
      .finally(() => {
        done = true;
        app.quit();
      });
  });
}
