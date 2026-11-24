import type { GithubPull } from "@agentic/contracts";
import { createPull } from "../api/pulls";
import { getRepo, splitRepo } from "../api/repos";
import type { GithubConnection } from "../auth/connection";
import { currentBranch, originRepo } from "../local/git";
import { pushBranch } from "../local/worktree";
import { gitAuth } from "./git-auth";

/** Called after a PR is opened, e.g. to link it on the Jira issues it names. */
export type PullOpenedHook = (repo: string, pull: GithubPull) => Promise<unknown>;

type OpenPullInput = {
  repo?: string;
  title: string;
  body: string;
  head?: string;
  base?: string;
  draft: boolean;
};

/**
 * Opens a pull request for the working dir's branch: pushes it first when
 * no `head` is given, and targets the repo's default branch by default.
 */
export async function openPull(
  conn: GithubConnection,
  gitHost: string,
  input: OpenPullInput,
  cwd: string,
  onOpened?: PullOpenedHook,
): Promise<GithubPull> {
  const fullName = input.repo ?? (await originRepo(cwd, gitHost));
  let head = input.head;
  if (!head) {
    head = await currentBranch(cwd);
    await pushBranch(cwd, head, await gitAuth(conn, gitHost));
  }
  const api = await conn.api();
  const ref = splitRepo(fullName);
  const base = input.base ?? (await getRepo(api, ref)).defaultBranch;
  const pull = await createPull(api, ref, {
    title: input.title,
    body: input.body,
    head,
    base,
    draft: input.draft,
  });
  await onOpened?.(fullName, pull);
  return pull;
}
