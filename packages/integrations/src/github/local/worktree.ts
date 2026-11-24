import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppError } from "@agentic/contracts";
import { type GitAuth, git } from "./git";

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * A blobless clone of `owner/name` under `reposRoot`, fetched again when it
 * already exists. Clones carry no credentials; each fetch sends the token
 * through the environment.
 */
export async function ensureClone(
  reposRoot: string,
  repo: string,
  auth: GitAuth | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const path = join(reposRoot, ...repo.split("/"));
  if (await exists(join(path, ".git"))) {
    await git(["fetch", "--prune", "origin"], { cwd: path, auth, signal, timeoutMs: 300_000 });
    return path;
  }
  await mkdir(dirname(path), { recursive: true });
  const url = `https://${auth?.host ?? "github.com"}/${repo}.git`;
  await git(["clone", "--filter=blob:none", url, path], {
    cwd: dirname(path),
    auth,
    signal,
    timeoutMs: 600_000,
  });
  return path;
}

/**
 * The worktree at `path` on `branch`, created from `base` the first time.
 * Idempotent, so a resumed run (or a second node) finds the same one.
 */
export async function ensureWorktree(
  repoPath: string,
  path: string,
  branch: string,
  base: string,
): Promise<string> {
  if (await exists(join(path, ".git"))) return path;
  if (await exists(path)) {
    throw new AppError("conflict", `${path} exists but is not a worktree`);
  }
  await mkdir(dirname(path), { recursive: true });
  const known = await git(["branch", "--list", branch], { cwd: repoPath });
  const args = known.trim()
    ? ["worktree", "add", path, branch]
    : ["worktree", "add", "-b", branch, path, base];
  await git(args, { cwd: repoPath });
  return path;
}

/** Pushes the worktree's branch to origin and sets it as upstream. */
export async function pushBranch(cwd: string, branch: string, auth: GitAuth | undefined) {
  await git(["push", "-u", "origin", `HEAD:refs/heads/${branch}`], {
    cwd,
    auth,
    timeoutMs: 300_000,
  });
  return { branch };
}
