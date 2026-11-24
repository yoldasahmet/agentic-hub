import { join } from "node:path";
import type { LogLevel } from "@agentic/contracts";
import {
  configureLogging,
  envLogLevel,
  type LoggingHandle,
  logCrashes,
  rootLogger,
} from "@agentic/logger";

type Options = {
  /** Default `<dataDir>/logs`. */
  logDir: string | undefined;
  dataDir: string;
  env: Record<string, string | undefined>;
  /** Terminal output from this level up (headless), or none (inside the app). */
  console: LogLevel | false;
};

/** Core writes `core.log` in the app's log folder (desktop) or `<dataDir>/logs` (headless). */
export function startCoreLogging(options: Options): LoggingHandle {
  const handle = configureLogging({
    proc: "core",
    level: envLogLevel(options.env, "info"),
    dir: options.logDir ?? join(options.dataDir, "logs"),
    console: options.console,
  });
  logCrashes(rootLogger().child({ module: "core" }));
  return handle;
}
