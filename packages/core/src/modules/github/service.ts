import {
  type CreatePullInput,
  type CreateReviewInput,
  createPullInputSchema,
  createReviewInputSchema,
  type GithubListQuery,
  type GithubPull,
  githubListQuerySchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import {
  addComment,
  createPull,
  createReview,
  type GithubConnection,
  getIssue,
  getPull,
  getRepo,
  listComments,
  listIssues,
  listPullFiles,
  listPulls,
  listRepos,
  listReviewComments,
  listReviews,
  type RepoRef,
} from "@agentic/integrations";

/**
 * The GitHub views: repos, issues, pull requests, and their conversations.
 * One token per app (the vault or gh), so calls aren't workspace-scoped.
 */
export class GithubService {
  constructor(
    private readonly conn: GithubConnection,
    private readonly onPullOpened?: (
      workspaceId: string,
      repo: string,
      pull: GithubPull,
    ) => Promise<unknown>,
  ) {}

  async repos(page: number) {
    return listRepos(await this.conn.api(), page);
  }

  async repo(ref: RepoRef) {
    return getRepo(await this.conn.api(), ref);
  }

  async issues(ref: RepoRef, raw: GithubListQuery) {
    const q = githubListQuerySchema.parse(raw);
    return listIssues(await this.conn.api(), ref, { ...q, sort: "updated" });
  }

  async issue(ref: RepoRef, number: number) {
    const api = await this.conn.api();
    const [issue, comments] = await Promise.all([
      getIssue(api, ref, number),
      listComments(api, ref, number),
    ]);
    return { issue, comments };
  }

  async pulls(ref: RepoRef, raw: GithubListQuery) {
    return listPulls(await this.conn.api(), ref, githubListQuerySchema.parse(raw));
  }

  async pull(ref: RepoRef, number: number) {
    const api = await this.conn.api();
    const [pull, comments, reviews, reviewComments] = await Promise.all([
      getPull(api, ref, number),
      listComments(api, ref, number),
      listReviews(api, ref, number),
      listReviewComments(api, ref, number),
    ]);
    return { pull, comments, reviews, reviewComments };
  }

  async pullFiles(ref: RepoRef, number: number) {
    return listPullFiles(await this.conn.api(), ref, number);
  }

  async comment(ref: RepoRef, number: number, body: string) {
    return addComment(await this.conn.api(), ref, number, body);
  }

  async createPull(ctx: LocalContext, ref: RepoRef, raw: CreatePullInput) {
    const pull = await createPull(await this.conn.api(), ref, createPullInputSchema.parse(raw));
    await this.onPullOpened?.(ctx.workspaceId, `${ref.owner}/${ref.repo}`, pull).catch(
      () => undefined,
    );
    return pull;
  }

  async review(ref: RepoRef, number: number, raw: CreateReviewInput) {
    return createReview(await this.conn.api(), ref, number, createReviewInputSchema.parse(raw));
  }
}
