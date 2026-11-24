import { z } from "zod";

/** `owner/name`, as GitHub spells a repository. */
export const repoFullNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "Use owner/name");
export type RepoFullName = z.infer<typeof repoFullNameSchema>;

export const githubUserSchema = z.object({
  login: z.string(),
  avatarUrl: z.string().nullable(),
});
export type GithubUser = z.infer<typeof githubUserSchema>;

export const githubLabelSchema = z.object({ name: z.string(), color: z.string() });
export type GithubLabel = z.infer<typeof githubLabelSchema>;

export const githubRepoSchema = z.object({
  fullName: repoFullNameSchema,
  description: z.string().nullable(),
  private: z.boolean(),
  defaultBranch: z.string(),
  url: z.string(),
  cloneUrl: z.string(),
  updatedAt: z.string().nullable(),
  openIssues: z.number().int(),
});
export type GithubRepo = z.infer<typeof githubRepoSchema>;

/** The fields issues and pull requests share in lists. */
const itemBase = {
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  author: githubUserSchema.nullable(),
  labels: z.array(githubLabelSchema),
  comments: z.number().int(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const githubIssueSchema = z.object({
  ...itemBase,
  state: z.enum(["open", "closed"]),
  assignees: z.array(githubUserSchema),
});
export type GithubIssue = z.infer<typeof githubIssueSchema>;

export const githubPullSchema = z.object({
  ...itemBase,
  state: z.enum(["open", "closed", "merged"]),
  draft: z.boolean(),
  head: z.string(),
  headSha: z.string(),
  base: z.string(),
  requestedReviewers: z.array(githubUserSchema),
  additions: z.number().int().nullable(),
  deletions: z.number().int().nullable(),
  changedFiles: z.number().int().nullable(),
  mergeable: z.boolean().nullable(),
});
export type GithubPull = z.infer<typeof githubPullSchema>;

export const githubFileStatusSchema = z.enum([
  "added",
  "removed",
  "modified",
  "renamed",
  "copied",
  "changed",
  "unchanged",
]);

/** One changed file of a pull request; `patch` is absent for binary or huge files. */
export const githubPullFileSchema = z.object({
  filename: z.string(),
  previousFilename: z.string().nullable(),
  status: githubFileStatusSchema,
  additions: z.number().int(),
  deletions: z.number().int(),
  patch: z.string().nullable(),
});
export type GithubPullFile = z.infer<typeof githubPullFileSchema>;

export const githubCommentSchema = z.object({
  id: z.number().int(),
  author: githubUserSchema.nullable(),
  body: z.string(),
  createdAt: z.string(),
  url: z.string(),
  /** Set for review comments on a line of the diff. */
  path: z.string().nullable(),
  line: z.number().int().nullable(),
});
export type GithubComment = z.infer<typeof githubCommentSchema>;

export const githubReviewStateSchema = z.enum([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
]);

export const githubReviewSchema = z.object({
  id: z.number().int(),
  author: githubUserSchema.nullable(),
  state: githubReviewStateSchema,
  body: z.string(),
  submittedAt: z.string().nullable(),
});
export type GithubReview = z.infer<typeof githubReviewSchema>;

export const githubMergeSchema = z.object({
  merged: z.boolean(),
  sha: z.string(),
  message: z.string(),
});
export type GithubMerge = z.infer<typeof githubMergeSchema>;
