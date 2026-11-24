import type { Logger } from "./logger";

let installed = false;

/**
 * Logs an uncaught exception or unhandled rejection before the process
 * reacts to it. A monitor, not a handler: the process still crashes (or
 * Electron still shows its dialog) as it would without logging.
 */
export function logCrashes(log: Logger): void {
  if (installed) return;
  installed = true;
  process.on("uncaughtExceptionMonitor", (err, origin) => {
    log.fatal({ err, origin }, "uncaught exception");
  });
}
