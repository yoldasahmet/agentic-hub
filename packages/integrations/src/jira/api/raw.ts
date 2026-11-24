import { z } from "zod";
import { adfNodeSchema } from "../adf/schema";

/** The slices of Jira's REST v3 payloads the app reads, validated at the boundary. */
export const rawUserSchema = z.object({
  accountId: z.string(),
  displayName: z.string().default(""),
  avatarUrls: z.record(z.string(), z.string()).optional(),
});
export type RawUser = z.infer<typeof rawUserSchema>;

export const rawStatusSchema = z.object({
  name: z.string(),
  statusCategory: z.object({ key: z.string() }).optional(),
});
export type RawStatus = z.infer<typeof rawStatusSchema>;

const rawRefSchema = z.object({
  key: z.string(),
  fields: z
    .object({ summary: z.string().default(""), status: rawStatusSchema.optional() })
    .default({ summary: "" }),
});
export type RawRef = z.infer<typeof rawRefSchema>;

export const rawIssueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtask: z.boolean().default(false),
});

export const rawIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  fields: z.object({
    summary: z.string().default(""),
    description: adfNodeSchema.nullish(),
    status: rawStatusSchema,
    issuetype: rawIssueTypeSchema,
    priority: z.object({ name: z.string() }).nullish(),
    assignee: rawUserSchema.nullish(),
    reporter: rawUserSchema.nullish(),
    labels: z.array(z.string()).default([]),
    parent: rawRefSchema.nullish(),
    subtasks: z.array(rawRefSchema).default([]),
    created: z.string(),
    updated: z.string(),
  }),
});
export type RawIssue = z.infer<typeof rawIssueSchema>;

/** The fields every issue read asks for, so lists and details map the same way. */
export const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "labels",
  "parent",
  "subtasks",
  "created",
  "updated",
];

export const rawProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
});

export const rawCommentSchema = z.object({
  id: z.string(),
  author: rawUserSchema.nullish(),
  body: adfNodeSchema.nullish(),
  created: z.string(),
});
export type RawComment = z.infer<typeof rawCommentSchema>;

export const rawTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  to: rawStatusSchema,
});

export const rawRemoteLinkSchema = z.object({
  id: z.number().int(),
  object: z.object({ url: z.string(), title: z.string().default("") }),
});
