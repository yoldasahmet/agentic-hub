import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type CoreRuntimeInfo, coreRuntimeInfoSchema } from "@agentic/contracts";
import { defaultHeadlessDataDir, runtimeFilePath } from "@agentic/core/paths";

/** The desktop app keeps its original profile folder so upgrades and CLI discovery share one path. */
function desktopDataDir(): string {
  const home = homedir();
  if (process.platform === "darwin") return join(home, "Library", "Application Support", "Agentic");
  if (process.platform === "win32")
    return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "Agentic");
  return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "Agentic");
}

/** Where to look, in order: an explicit folder, then the desktop app, then headless `serve`. */
export function candidateDataDirs(explicit?: string): string[] {
  const dir = explicit ?? process.env.AGENTIC_DATA_DIR;
  return dir ? [dir] : [desktopDataDir(), defaultHeadlessDataDir()];
}

export type Located = { path: string; info: CoreRuntimeInfo; alive: boolean };

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return err instanceof Error && "code" in err && err.code === "EPERM";
  }
}

async function readRuntimeFile(path: string): Promise<Located | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return undefined;
  }
  const parsed = coreRuntimeInfoSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return undefined;
  return { path, info: parsed.data, alive: isAlive(parsed.data.pid) };
}

/**
 * Every runtime file found, live ones first and newest first. A file left
 * behind by a crashed Core is reported (doctor) but never connected to.
 */
export async function locateCores(explicit?: string): Promise<Located[]> {
  const found = await Promise.all(
    candidateDataDirs(explicit).map((dir) =>
      readRuntimeFile(runtimeFilePath(dir)).catch(() => undefined),
    ),
  );
  return found
    .filter((entry): entry is Located => entry !== undefined)
    .sort(
      (a, b) =>
        Number(b.alive) - Number(a.alive) || b.info.startedAt.localeCompare(a.info.startedAt),
    );
}
