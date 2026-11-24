import { z } from "zod";
import type { SecretName } from "../secrets";

/** Vault entries the Jira integration reads. Main hands them to Core like the GitHub token. */
export const JIRA_SECRETS = {
  token: "jira.token",
} as const satisfies Record<string, SecretName>;

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/** `https://<site>.atlassian.net`; plain http only for a local stand-in. No trailing slash. */
export const jiraSiteUrlSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.test(url.hostname));
  }, "Use the https:// address of your Jira site")
  .transform((value) => value.replace(/\/+$/, ""));

/** Non-secret Jira settings: the site and the account email the API token belongs to. */
export const jiraSettingsSchema = z.object({
  siteUrl: z.union([z.literal(""), jiraSiteUrlSchema]).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
});
export type JiraSettings = z.infer<typeof jiraSettingsSchema>;

export const jiraUserSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type JiraUser = z.infer<typeof jiraUserSchema>;

export const jiraAuthStatusSchema = z.object({
  siteUrl: z.string(),
  email: z.string(),
  hasToken: z.boolean(),
  /** Null until the site, email, and token are set and Jira accepts them. */
  user: jiraUserSchema.nullable(),
  error: z.string().nullable(),
});
export type JiraAuthStatus = z.infer<typeof jiraAuthStatusSchema>;

/** Tests a site and email (before saving) with the vault token, or a token typed just now. */
export const jiraConnectionTestSchema = z.object({
  siteUrl: jiraSiteUrlSchema,
  email: z.email(),
  token: z.string().min(1).max(4096).optional(),
});
export type JiraConnectionTest = z.input<typeof jiraConnectionTestSchema>;

export const jiraConnectionResultSchema = z.object({
  ok: z.boolean(),
  user: jiraUserSchema.nullable(),
  error: z.string().nullable(),
});
export type JiraConnectionResult = z.infer<typeof jiraConnectionResultSchema>;
