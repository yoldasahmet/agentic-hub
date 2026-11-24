import { constants } from "node:fs";
import { access, lstat, mkdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { app } from "electron";

export type CliInstall = { link: string; target: string; onPath: boolean };

/**
 * The `agentic` launcher: in dev, apps/cli/bin next to apps/desktop; once
 * packaged, the copy P18 bundles into the app's resources.
 */
function launcherPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "cli", "agentic")
    : join(app.getAppPath(), "..", "cli", "bin", "agentic.mjs");
}

/** `/usr/local/bin` when writable (no admin prompt), else `~/.local/bin`. */
const linkDirs = () => ["/usr/local/bin", join(homedir(), ".local", "bin")];

const exists = (path: string, mode = constants.F_OK) =>
  access(path, mode).then(
    () => true,
    () => false,
  );

/** Replaces an older symlink, but never a real file someone put there. */
async function placeLink(link: string, target: string): Promise<void> {
  const current = await lstat(link).catch(() => undefined);
  if (current && !current.isSymbolicLink())
    throw new Error(`${link} exists and isn't a link. Remove it, then try again.`);
  if (current) await rm(link);
  await symlink(target, link);
}

/** Symlinks `agentic` into the first writable folder of `linkDirs`. */
export async function installCli(): Promise<CliInstall> {
  const target = launcherPath();
  if (!(await exists(target, constants.X_OK)))
    throw new Error(`The CLI isn't included in this build (${target} is missing).`);
  const dirs = linkDirs();
  for (const dir of dirs) {
    const isLast = dir === dirs.at(-1);
    if (isLast) await mkdir(dir, { recursive: true });
    else if (!(await exists(dir, constants.W_OK))) continue;
    const link = join(dir, "agentic");
    await placeLink(link, target);
    const onPath = (process.env.PATH ?? "").split(delimiter).includes(dirname(link));
    return { link, target, onPath };
  }
  throw new Error("No folder to install the CLI into.");
}
