import type { GithubComment, GithubIssue } from "@agentic/contracts";
import type { GithubApi } from "./client";
import { hasNextPage } from "./client";
import { gh } from "./errors";
import { toComment, toIssue } from "./mappers";
import type { Paged, RepoRef } from "./repos";

export type IssueFilter = {
  state?: "open" | "closed" | "all";
  labels?: string;
  since?: string;
  sort?: "created" | "updated";
  page?: number;
  perPage?: number;
};

/** Issues only: GitHub's issue list includes pull requests, which are dropped here. */
export async function listIssues(
  api: GithubApi,
  ref: RepoRef,
  filter: IssueFilter = {},
): Promise<Paged<GithubIssue>> {
  const page = filter.page ?? 1;
  const res = await gh(
    api.rest.issues.listForRepo({
      ...ref,
      state: filter.state ?? "open",
      labels: filter.labels,
      since: filter.since,
      sort: filter.sort ?? "updated",
      direction: "desc",
      per_page: filter.perPage ?? 30,
      page,
    }),
  );
  const items = res.data.filter((i) => !i.pull_request).map(toIssue);
  return { items, page, hasMore: hasNextPage(res.headers) };
}

export async function getIssue(api: GithubApi, ref: RepoRef, number: number): Promise<GithubIssue> {
  return toIssue((await gh(api.rest.issues.get({ ...ref, issue_number: number }))).data);
}

/** The conversation of an issue or pull request (not line comments on a diff). */
export async function listComments(
  api: GithubApi,
  ref: RepoRef,
  number: number,
): Promise<GithubComment[]> {
  const rows = await gh(
    api.paginate(api.rest.issues.listComments, { ...ref, issue_number: number, per_page: 100 }),
  );
  return rows.map(toComment);
}

export async function addComment(
  api: GithubApi,
  ref: RepoRef,
  number: number,
  body: string,
): Promise<GithubComment> {
  const res = await gh(api.rest.issues.createComment({ ...ref, issue_number: number, body }));
  return toComment(res.data);
}
