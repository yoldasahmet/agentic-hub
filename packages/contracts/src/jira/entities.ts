import { z } from "zod";
import { jiraUserSchema } from "./auth";

/** `ABC-123`, as Jira spells an issue key. */
export const jiraKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]+-\d+$/, "Use an issue key like ABC-123");
export const jiraProjectKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]+$/, "Use a project key like ABC");

export const jiraProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type JiraProject = z.infer<typeof jiraProjectSchema>;

/** Jira groups every status into one of three categories; the colors follow them. */
export const jiraStatusSchema = z.object({
  name: z.string(),
  category: z.enum(["new", "indeterminate", "done"]).catch("indeterminate"),
});
export type JiraStatus = z.infer<typeof jiraStatusSchema>;

export const jiraIssueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtask: z.boolean(),
});
export type JiraIssueType = z.infer<typeof jiraIssueTypeSchema>;

export const jiraIssueRefSchema = z.object({
  key: z.string(),
  summary: z.string(),
  status: jiraStatusSchema,
});
export type JiraIssueRef = z.infer<typeof jiraIssueRefSchema>;

/** An issue with its description converted from ADF to Markdown. */
export const jiraIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  description: z.string(),
  status: jiraStatusSchema,
  issueType: jiraIssueTypeSchema,
  priority: z.string().nullable(),
  assignee: jiraUserSchema.nullable(),
  reporter: jiraUserSchema.nullable(),
  labels: z.array(z.string()),
  parent: jiraIssueRefSchema.nullable(),
  subtasks: z.array(jiraIssueRefSchema),
  created: z.string(),
  updated: z.string(),
  url: z.string(),
});
export type JiraIssue = z.infer<typeof jiraIssueSchema>;

export const jiraCommentSchema = z.object({
  id: z.string(),
  author: jiraUserSchema.nullable(),
  body: z.string(),
  created: z.string(),
});
export type JiraComment = z.infer<typeof jiraCommentSchema>;

export const jiraTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  to: jiraStatusSchema,
});
export type JiraTransition = z.infer<typeof jiraTransitionSchema>;

/** A web link on an issue, e.g. the pull request that implements it. */
export const jiraRemoteLinkSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  title: z.string(),
});
export type JiraRemoteLink = z.infer<typeof jiraRemoteLinkSchema>;
