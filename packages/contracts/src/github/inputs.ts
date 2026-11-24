import { z } from "zod";
import { repoFullNameSchema } from "./entities";

export const githubRepoParamSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

export const githubItemParamSchema = githubRepoParamSchema.extend({
  number: z.coerce.number().int().positive(),
});

export const githubItemStateSchema = z.enum(["open", "closed", "all"]);

export const githubListQuerySchema = z.object({
  state: githubItemStateSchema.default("open"),
  page: z.coerce.number().int().min(1).max(100).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});
export type GithubListQuery = z.input<typeof githubListQuerySchema>;

export const githubCommentInputSchema = z.object({ body: z.string().trim().min(1).max(65_536) });
export type GithubCommentInput = z.input<typeof githubCommentInputSchema>;

export const createPullInputSchema = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(65_536).default(""),
  head: z.string().trim().min(1).max(255),
  base: z.string().trim().min(1).max(255),
  draft: z.boolean().default(false),
});
export type CreatePullInput = z.input<typeof createPullInputSchema>;

export const reviewEventSchema = z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]);

/** A review with optional line comments on the head commit (RIGHT side). */
export const createReviewInputSchema = z.object({
  event: reviewEventSchema,
  body: z.string().max(65_536).default(""),
  comments: z
    .array(
      z.object({
        path: z.string().min(1),
        line: z.number().int().positive(),
        body: z.string().trim().min(1).max(65_536),
      }),
    )
    .max(100)
    .default([]),
});
export type CreateReviewInput = z.input<typeof createReviewInputSchema>;

export const mergeMethodSchema = z.enum(["merge", "squash", "rebase"]);

export const mergePullInputSchema = z.object({
  method: mergeMethodSchema.default("squash"),
  /** Fails the merge if the head moved since it was reviewed. */
  sha: z.string().max(64).optional(),
});
export type MergePullInput = z.input<typeof mergePullInputSchema>;

/** Paged results: `hasMore` comes from GitHub's Link header. */
export const githubPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number().int(), hasMore: z.boolean() });

export const cloneRepoInputSchema = z.object({ repo: repoFullNameSchema });
