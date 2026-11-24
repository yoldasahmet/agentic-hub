import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import { AppError } from "@agentic/contracts";

/**
 * Resolves and checks a working directory before anything is spawned in
 * it: absolute, existing, a directory, symlinks resolved. The allowlist of
 * permitted roots joins this check in P9.4.
 */
export async function validateWorkingDir(dir: string | undefined): Promise<string> {
  const target = dir ?? homedir();
  if (!isAbsolute(target) || target.includes("\0")) {
    throw new AppError("cli.cwd_invalid", "The working directory must be an absolute path", {
      cwd: target,
    });
  }
  let resolved: string;
  try {
    resolved = await realpath(target);
  } catch {
    throw new AppError("cli.cwd_invalid", "The working directory does not exist", { cwd: target });
  }
  if (!(await stat(resolved)).isDirectory()) {
    throw new AppError("cli.cwd_invalid", "The working directory is not a directory", {
      cwd: target,
    });
  }
  return resolved;
}
