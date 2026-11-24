import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT_NAME } from "@agentic/contracts";
import { configureLogging, envLogLevel, logCrashes, moduleLogger } from "@agentic/logger";
import { app } from "electron";

/** `~/Library/Logs/Agentic Hub` on macOS (where Console.app looks), else `<userData>/logs`. */
function appLogDir(): string {
  return process.platform === "darwin"
    ? join(homedir(), "Library", "Logs", PRODUCT_NAME)
    : join(app.getPath("userData"), "logs");
}

/**
 * Main's `main.log` (renderer reports included) next to Core's `core.log`.
 * Debug in dev, info when packaged; AGENTIC_LOG_LEVEL overrides both.
 */
export function startMainLogging(): string {
  const dir = appLogDir();
  app.setAppLogsPath(dir);
  configureLogging({
    proc: "main",
    level: envLogLevel(process.env, app.isPackaged ? "info" : "debug"),
    dir,
    console: app.isPackaged ? false : "info",
  });
  const log = moduleLogger("main");
  logCrashes(log);
  log.info(
    {
      version: app.getVersion(),
      electron: process.versions.electron,
      platform: process.platform,
      arch: process.arch,
    },
    "app starting",
  );
  return dir;
}
