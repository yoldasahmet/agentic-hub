import { z } from "zod";
import { jiraKeySchema, jiraProjectKeySchema } from "./entities";

export const jiraKeyParamSchema = z.object({ key: jiraKeySchema });
export const jiraProjectParamSchema = z.object({ projectKey: jiraProjectKeySchema });

export const jiraJqlSchema = z.string().trim().min(1).max(4000);

export const jiraSearchQuerySchema = z.object({
  jql: jiraJqlSchema,
  /** Jira's enhanced search pages with an opaque token instead of offsets. */
  pageToken: z.string().max(2048).optional(),
  maxResults: z.coerce.number().int().min(1).max(100).default(30),
});
export type JiraSearchQuery = z.input<typeof jiraSearchQuerySchema>;

export const jiraProjectsQuerySchema = z.object({
  query: z.string().max(100).optional(),
  startAt: z.coerce.number().int().min(0).default(0),
});
export type JiraProjectsQuery = z.input<typeof jiraProjectsQuerySchema>;

/** Markdown; Core converts it to ADF. */
export const jiraCommentInputSchema = z.object({ body: z.string().trim().min(1).max(32_768) });
export type JiraCommentInput = z.input<typeof jiraCommentInputSchema>;

export const jiraTransitionInputSchema = z.object({
  transitionId: z.string().trim().min(1).max(32),
});
export type JiraTransitionInput = z.input<typeof jiraTransitionInputSchema>;

export const createJiraIssueInputSchema = z.object({
  projectKey: jiraProjectKeySchema,
  /** The issue type's name, e.g. "Task", "Bug", or "Sub-task". */
  issueType: z.string().trim().min(1).max(64),
  summary: z.string().trim().min(1).max(255),
  /** Markdown; Core converts it to ADF. */
  description: z.string().max(32_768).default(""),
  /** Makes a sub-task of this issue. */
  parentKey: jiraKeySchema.optional(),
  labels: z.array(z.string().trim().min(1).max(255).regex(/^\S+$/)).max(20).default([]),
});
export type CreateJiraIssueInput = z.input<typeof createJiraIssueInputSchema>;

export const jiraLinkInputSchema = z.object({
  url: z.url(),
  title: z.string().trim().min(1).max(255),
});
export type JiraLinkInput = z.input<typeof jiraLinkInputSchema>;

/** Token-paged search results: `nextPageToken` is null on the last page. */
export const jiraPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextPageToken: z.string().nullable() });

export const jiraProjectPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), startAt: z.number().int(), hasMore: z.boolean() });
