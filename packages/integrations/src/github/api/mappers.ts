import type {
  GithubComment,
  GithubIssue,
  GithubLabel,
  GithubPull,
  GithubPullFile,
  GithubRepo,
  GithubReview,
  GithubUser,
} from "@agentic/contracts";
import { githubFileStatusSchema, githubReviewStateSchema } from "@agentic/contracts";

/** The slices of GitHub's REST payloads the app reads; Octokit's types satisfy them. */
type RawUser = { login: string; avatar_url?: string | null } | null | undefined;
type RawLabel = string | { name?: string | null; color?: string | null };

export const toUser = (u: RawUser): GithubUser | null =>
  u ? { login: u.login, avatarUrl: u.avatar_url ?? null } : null;

const users = (list: RawUser[] | null | undefined): GithubUser[] =>
  (list ?? []).map(toUser).filter((u) => u !== null);

const toLabels = (labels: RawLabel[] | undefined): GithubLabel[] =>
  (labels ?? []).map((l) =>
    typeof l === "string"
      ? { name: l, color: "888888" }
      : { name: l.name ?? "", color: l.color ?? "888888" },
  );

export function toRepo(r: {
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch?: string;
  html_url: string;
  clone_url?: string;
  updated_at?: string | null;
  open_issues_count?: number;
}): GithubRepo {
  return {
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    defaultBranch: r.default_branch ?? "main",
    url: r.html_url,
    cloneUrl: r.clone_url ?? `${r.html_url}.git`,
    updatedAt: r.updated_at ?? null,
    openIssues: r.open_issues_count ?? 0,
  };
}

type RawItem = {
  number: number;
  title: string;
  body?: string | null;
  user?: RawUser;
  labels?: RawLabel[];
  comments?: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  state: string;
};

const item = (i: RawItem) => ({
  number: i.number,
  title: i.title,
  body: i.body ?? "",
  author: toUser(i.user),
  labels: toLabels(i.labels),
  comments: i.comments ?? 0,
  url: i.html_url,
  createdAt: i.created_at,
  updatedAt: i.updated_at,
});

export function toIssue(i: RawItem & { assignees?: RawUser[] | null }): GithubIssue {
  return {
    ...item(i),
    state: i.state === "closed" ? "closed" : "open",
    assignees: users(i.assignees),
  };
}

export function toPull(
  p: RawItem & {
    draft?: boolean;
    merged_at?: string | null;
    head: { ref: string; sha: string };
    base: { ref: string };
    requested_reviewers?: RawUser[] | null;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    mergeable?: boolean | null;
  },
): GithubPull {
  return {
    ...item(p),
    state: p.merged_at ? "merged" : p.state === "closed" ? "closed" : "open",
    draft: p.draft ?? false,
    head: p.head.ref,
    headSha: p.head.sha,
    base: p.base.ref,
    requestedReviewers: users(p.requested_reviewers),
    additions: p.additions ?? null,
    deletions: p.deletions ?? null,
    changedFiles: p.changed_files ?? null,
    mergeable: p.mergeable ?? null,
  };
}

export function toPullFile(f: {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}): GithubPullFile {
  return {
    filename: f.filename,
    previousFilename: f.previous_filename ?? null,
    status: githubFileStatusSchema.catch("changed").parse(f.status),
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  };
}

export function toComment(c: {
  id: number;
  user?: RawUser;
  body?: string;
  created_at: string;
  html_url: string;
  path?: string;
  line?: number | null;
}): GithubComment {
  return {
    id: c.id,
    author: toUser(c.user),
    body: c.body ?? "",
    createdAt: c.created_at,
    url: c.html_url,
    path: c.path ?? null,
    line: c.line ?? null,
  };
}

export function toReview(r: {
  id: number;
  user?: RawUser;
  state: string;
  body?: string | null;
  submitted_at?: string;
}): GithubReview {
  return {
    id: r.id,
    author: toUser(r.user),
    state: githubReviewStateSchema.catch("COMMENTED").parse(r.state),
    body: r.body ?? "",
    submittedAt: r.submitted_at ?? null,
  };
}
