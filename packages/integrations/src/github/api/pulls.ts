import type {
  CreatePullInput,
  CreateReviewInput,
  GithubComment,
  GithubMerge,
  GithubPull,
  GithubPullFile,
  GithubReview,
  MergePullInput,
} from "@agentic/contracts";
import type { GithubApi } from "./client";
import { hasNextPage } from "./client";
import { gh } from "./errors";
import { toComment, toPull, toPullFile, toReview } from "./mappers";
import type { Paged, RepoRef } from "./repos";

export async function listPulls(
  api: GithubApi,
  ref: RepoRef,
  filter: { state?: "open" | "closed" | "all"; page?: number; perPage?: number } = {},
): Promise<Paged<GithubPull>> {
  const page = filter.page ?? 1;
  const res = await gh(
    api.rest.pulls.list({
      ...ref,
      state: filter.state ?? "open",
      sort: "updated",
      direction: "desc",
      per_page: filter.perPage ?? 30,
      page,
    }),
  );
  return { items: res.data.map(toPull), page, hasMore: hasNextPage(res.headers) };
}

export async function getPull(api: GithubApi, ref: RepoRef, number: number): Promise<GithubPull> {
  return toPull((await gh(api.rest.pulls.get({ ...ref, pull_number: number }))).data);
}

/** Changed files with their patches (GitHub caps a pull at 3000 files). */
export async function listPullFiles(
  api: GithubApi,
  ref: RepoRef,
  number: number,
): Promise<GithubPullFile[]> {
  const rows = await gh(
    api.paginate(api.rest.pulls.listFiles, { ...ref, pull_number: number, per_page: 100 }),
  );
  return rows.map(toPullFile);
}

export async function listReviews(
  api: GithubApi,
  ref: RepoRef,
  number: number,
): Promise<GithubReview[]> {
  const rows = await gh(
    api.paginate(api.rest.pulls.listReviews, { ...ref, pull_number: number, per_page: 100 }),
  );
  return rows.map(toReview);
}

/** Line comments on the diff, shown next to the conversation. */
export async function listReviewComments(
  api: GithubApi,
  ref: RepoRef,
  number: number,
): Promise<GithubComment[]> {
  const rows = await gh(
    api.paginate(api.rest.pulls.listReviewComments, { ...ref, pull_number: number, per_page: 100 }),
  );
  return rows.map(toComment);
}

export async function createPull(
  api: GithubApi,
  ref: RepoRef,
  input: Required<CreatePullInput>,
): Promise<GithubPull> {
  return toPull((await gh(api.rest.pulls.create({ ...ref, ...input }))).data);
}

export async function mergePull(
  api: GithubApi,
  ref: RepoRef,
  number: number,
  input: MergePullInput,
): Promise<GithubMerge> {
  const res = await gh(
    api.rest.pulls.merge({
      ...ref,
      pull_number: number,
      merge_method: input.method ?? "squash",
      sha: input.sha,
    }),
  );
  return { merged: res.data.merged, sha: res.data.sha, message: res.data.message };
}

export async function createReview(
  api: GithubApi,
  ref: RepoRef,
  number: number,
  input: Required<CreateReviewInput>,
): Promise<GithubReview> {
  const res = await gh(
    api.rest.pulls.createReview({
      ...ref,
      pull_number: number,
      event: input.event,
      body: input.body || undefined,
      comments: input.comments.map((c) => ({ ...c, side: "RIGHT" })),
    }),
  );
  return toReview(res.data);
}

/** Open pulls asking the signed-in user for a review (search API). */
export async function reviewRequests(api: GithubApi, fullName: string) {
  const q = `is:pr is:open review-requested:@me repo:${fullName}`;
  const res = await gh(api.rest.search.issuesAndPullRequests({ q, per_page: 50, sort: "updated" }));
  return res.data.items;
}
