import { runProcess } from "./run-process";

/** Large diffs are cut here; the context panel is a glance, not a review tool. */
const MAX_DIFF_BYTES = 400_000;

/**
 * The working dir's uncommitted changes against HEAD (staged and unstaged)
 * as a unified diff, for the context panel. Not a repo → empty.
 */
export async function gitDiff(dir: string): Promise<{ diff: string; truncated: boolean }> {
  const out = await runProcess("git", ["diff", "HEAD", "--no-color", "--no-ext-diff"], {
    cwd: dir,
    timeoutMs: 15_000,
    maxOutputBytes: MAX_DIFF_BYTES,
    extraEnv: { GIT_OPTIONAL_LOCKS: "0" },
  });
  if (out.exitCode !== 0) return { diff: "", truncated: false };
  return { diff: out.stdout, truncated: out.truncated };
}
