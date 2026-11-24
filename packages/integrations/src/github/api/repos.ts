import type { GithubRepo } from "@agentic/contracts";
import type { GithubApi } from "./client";
import { hasNextPage } from "./client";
import { gh } from "./errors";
import { toRepo } from "./mappers";

export type RepoRef = { owner: string; repo: string };
export type Paged<T> = { items: T[]; page: number; hasMore: boolean };

/** `owner/name` → its parts; validation happens at the boundary (repoFullNameSchema). */
export function splitRepo(fullName: string): RepoRef {
  const [owner = "", repo = ""] = fullName.split("/");
  return { owner, repo };
}

/** The signed-in user and the scopes of a classic token (fine-grained tokens send none). */
export async function viewer(api: GithubApi) {
  const res = await gh(api.rest.users.getAuthenticated());
  const header = res.headers["x-oauth-scopes"];
  const scopes = typeof header === "string" ? header.split(",").map((s) => s.trim()) : [];
  return { login: res.data.login, avatarUrl: res.data.avatar_url, scopes: scopes.filter(Boolean) };
}

/** Repos the user can reach (own, collaborator, org member), most recently pushed first. */
export async function listRepos(
  api: GithubApi,
  page = 1,
  perPage = 50,
): Promise<Paged<GithubRepo>> {
  const res = await gh(
    api.rest.repos.listForAuthenticatedUser({ sort: "pushed", per_page: perPage, page }),
  );
  return { items: res.data.map(toRepo), page, hasMore: hasNextPage(res.headers) };
}

export async function getRepo(api: GithubApi, ref: RepoRef): Promise<GithubRepo> {
  return toRepo((await gh(api.rest.repos.get(ref))).data);
}

/** A text file at a ref (default branch when omitted). Directories and binaries are refused. */
export async function readFile(api: GithubApi, ref: RepoRef, path: string, at?: string) {
  const res = await gh(api.rest.repos.getContent({ ...ref, path, ref: at }));
  const data = res.data;
  if (Array.isArray(data)) {
    return {
      path,
      kind: "dir" as const,
      entries: data.map((e) => ({ name: e.name, type: e.type })),
    };
  }
  if (data.type !== "file" || !("content" in data)) {
    return { path, kind: data.type, entries: [] };
  }
  return {
    path,
    kind: "file" as const,
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf8"),
  };
}

/** Code search scoped to one repo. GitHub indexes the default branch only. */
export async function searchCode(api: GithubApi, fullName: string, query: string, perPage = 20) {
  const res = await gh(api.rest.search.code({ q: `${query} repo:${fullName}`, per_page: perPage }));
  return {
    total: res.data.total_count,
    items: res.data.items.map((i) => ({ path: i.path, url: i.html_url, sha: i.sha })),
  };
}

/** A branch from `from` (default: the repo's default branch). */
export async function createBranch(api: GithubApi, ref: RepoRef, branch: string, from?: string) {
  const base = from ?? (await getRepo(api, ref)).defaultBranch;
  const head = await gh(api.rest.git.getRef({ ...ref, ref: `heads/${base}` }));
  await gh(
    api.rest.git.createRef({ ...ref, ref: `refs/heads/${branch}`, sha: head.data.object.sha }),
  );
  return { branch, from: base, sha: head.data.object.sha };
}
