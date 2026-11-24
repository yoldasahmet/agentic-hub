import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type CoreRuntimeInfo, coreRuntimeInfoSchema } from "@agentic/contracts";
import { runtimeFilePath } from "./paths";

/** Written atomically with mode 0600 in a 0700 folder: only this user can read the token. */
export async function writeRuntimeFile(dataDir: string, info: CoreRuntimeInfo): Promise<void> {
  const path = runtimeFilePath(dataDir);
  await mkdir(join(dataDir, "runtime"), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(coreRuntimeInfoSchema.parse(info), null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temp, path);
}

/** Removes the file only if it still describes this process (a newer Core may own it). */
export async function removeRuntimeFile(dataDir: string, pid: number): Promise<void> {
  const path = runtimeFilePath(dataDir);
  try {
    const info = coreRuntimeInfoSchema.parse(JSON.parse(await readFile(path, "utf8")));
    if (info.pid === pid) await rm(path, { force: true });
  } catch {
    // Missing or unreadable: nothing of ours to remove.
  }
}
