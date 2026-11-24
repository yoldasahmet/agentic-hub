import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { AppError } from "@agentic/contracts";

export type DirRules = { scratchDir: string; allowedDirs: readonly string[] };

/**
 * A tool's working dir must be the scratch dir or inside an allowed folder,
 * compared after resolving symlinks so a link can't point a tool elsewhere.
 */
export async function checkToolDir(dir: string, rules: DirRules): Promise<string> {
  if (!isAbsolute(dir)) {
    throw new AppError("tool.dir_denied", "Tools need an absolute working dir", { dir });
  }
  const real = await realpath(dir).catch(() => {
    throw new AppError("tool.dir_denied", "The working dir does not exist", { dir });
  });
  const roots = [rules.scratchDir, ...rules.allowedDirs];
  for (const root of roots) {
    const realRoot = await realpath(root).catch(() => undefined);
    if (realRoot && isInside(realRoot, real)) return real;
  }
  throw new AppError(
    "tool.dir_denied",
    `Tools may not run in ${dir}. Add it under Settings → Tools → Allowed folders.`,
    { dir },
  );
}

/**
 * Resolves a path a tool was given against its working dir and refuses
 * anything outside it, symlinks included. A path that doesn't exist yet
 * (a file to write) is checked through its nearest existing parent.
 */
export async function resolveInside(cwd: string, path: string): Promise<string> {
  if (path.includes("\0")) throw new AppError("tool.path_denied", "Invalid path");
  const target = resolve(cwd, path);
  const real = await realExisting(target);
  if (!isInside(cwd, real)) {
    throw new AppError("tool.path_denied", `${path} is outside the working dir`, { path });
  }
  return target;
}

async function realExisting(target: string): Promise<string> {
  let current = target;
  const rest: string[] = [];
  for (;;) {
    try {
      const real = await realpath(current);
      return rest.length ? resolve(real, ...rest.reverse()) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return target;
      rest.push(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      current = parent;
    }
  }
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
