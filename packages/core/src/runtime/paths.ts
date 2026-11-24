import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Paths the CLI shares with Core. Exported as `@agentic/core/paths` so the
 * CLI can find a running Core without loading the whole backend.
 */

/** `<dataDir>/runtime/core.json`: how the CLI finds the running Core (P4.3). */
export const runtimeFilePath = (dataDir: string) => join(dataDir, "runtime", "core.json");

/** Where headless Core writes its runtime file unless AGENTIC_DATA_DIR says otherwise. */
export const defaultHeadlessDataDir = () => join(homedir(), ".agentic");
