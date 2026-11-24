import { moduleLogger, readLogs } from "@agentic/logger";
import { clipboard, shell } from "electron";
import type { CoreSupervisor } from "../core/core-supervisor";
import type { DatabaseSupervisor } from "../database/database-supervisor";
import { handle } from "../ipc/handle";
import type { Vault } from "../vault/vault";
import { buildDiagnostics } from "./diagnostics";

type Deps = { vault: Vault; database: DatabaseSupervisor; core: CoreSupervisor; logDir: string };

const rendererLog = moduleLogger("renderer");
const MAX_REPORT_CHARS = 16_000;

/** The log viewer's channels (P13.3) and the renderer's own error reports (P13.4). */
export function registerLogHandlers(deps: Deps): void {
  handle("logs.query", (query) => readLogs(deps.logDir, query));
  handle("logs.write", ({ level, msg, data }) => {
    // Renderer data is untrusted: size-capped here, redacted by the logger.
    const fields = data && JSON.stringify(data).length <= MAX_REPORT_CHARS ? data : {};
    rendererLog[level](fields, msg);
    return { ok: true };
  });
  handle("logs.copyDiagnostics", async () => {
    const { text, entries } = await buildDiagnostics(deps);
    clipboard.writeText(text);
    return { bytes: Buffer.byteLength(text), entries };
  });
  handle("logs.openFolder", async () => ({ ok: (await shell.openPath(deps.logDir)) === "" }));
}
