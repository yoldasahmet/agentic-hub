import {
  createReviewInputSchema,
  type GithubPull,
  mergePullInputSchema,
  repoFullNameSchema,
} from "@agentic/contracts";
import { defineTool } from "@agentic/tools";
import { z } from "zod";
import { addComment } from "../api/issues";
import { createReview, mergePull } from "../api/pulls";
import { createBranch, splitRepo } from "../api/repos";
import type { GithubConnection } from "../auth/connection";
import { currentBranch } from "../local/git";
import { pushBranch } from "../local/worktree";
import { gitAuth } from "./git-auth";
import { openPull } from "./open-pull";

/** Runs after an agent opens a PR (Core links it on Jira); never fails the tool. */
export type AgentPullHook = (
  workspaceId: string,
  repo: string,
  pull: GithubPull,
) => Promise<unknown>;

const repo = repoFullNameSchema.describe("owner/name");
const number = z.number().int().positive();

/**
 * GitHub tools with side effects. All are `write`, so the default policy
 * asks a person before an agent may use them.
 */
export function githubWriteTools(
  conn: GithubConnection,
  gitHost: string,
  onPullOpened?: AgentPullHook,
) {
  return [
    defineTool({
      name: "github.branch.create",
      title: "Create a branch",
      description: "Creates a branch on GitHub from another (default: the default branch).",
      permission: "write",
      input: z.object({
        repo,
        branch: z.string().trim().min(1).max(255),
        from: z.string().optional(),
      }),
      run: async (i) => createBranch(await conn.api(), splitRepo(i.repo), i.branch, i.from),
    }),
    defineTool({
      name: "github.push",
      title: "Push the branch",
      description:
        "Pushes the working dir's current branch (commit first with git.commit) to origin.",
      permission: "write",
      input: z.object({}),
      run: async (_i, ctx) =>
        pushBranch(ctx.cwd, await currentBranch(ctx.cwd), await gitAuth(conn, gitHost)),
    }),
    defineTool({
      name: "github.pr.create",
      title: "Open a pull request",
      description:
        "Opens a pull request. Without `head` it pushes the working dir's branch first; without `repo` it uses origin.",
      permission: "write",
      input: z.object({
        repo: repo.optional(),
        title: z.string().trim().min(1).max(256),
        body: z.string().max(65_536).default(""),
        head: z.string().max(255).optional(),
        base: z.string().max(255).optional(),
        draft: z.boolean().default(false),
      }),
      run: async (i, ctx) =>
        openPull(conn, gitHost, i, ctx.cwd, (repo, pull) =>
          (onPullOpened?.(ctx.workspaceId, repo, pull) ?? Promise.resolve()).catch(() => undefined),
        ),
    }),
    defineTool({
      name: "github.pr.merge",
      title: "Merge a pull request",
      description:
        "Merges a pull request (squash by default). Pass `sha` to refuse if the head moved.",
      permission: "write",
      input: mergePullInputSchema.extend({ repo, number }),
      run: async ({ repo: name, number: n, ...merge }) =>
        mergePull(await conn.api(), splitRepo(name), n, merge),
    }),
    defineTool({
      name: "github.comment",
      title: "Comment on GitHub",
      description: "Adds a comment to an issue or pull request.",
      permission: "write",
      input: z.object({ repo, number, body: z.string().trim().min(1).max(65_536) }),
      run: async (i) => addComment(await conn.api(), splitRepo(i.repo), i.number, i.body),
    }),
    defineTool({
      name: "github.review",
      title: "Review a pull request",
      description:
        "Submits a review (APPROVE, REQUEST_CHANGES, COMMENT) with optional line comments.",
      permission: "write",
      input: createReviewInputSchema.extend({ repo, number }),
      run: async ({ repo: name, number: n, ...review }) =>
        createReview(await conn.api(), splitRepo(name), n, review),
    }),
  ];
}
