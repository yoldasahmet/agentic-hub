import { z } from "zod";
import { jiraJqlSchema } from "./inputs";

/**
 * A Jira trigger: issues that newly match a JQL query start a workflow.
 * Polled, so it works without a public webhook URL.
 */
export const jiraTriggerSchema = z.object({
  jql: jiraJqlSchema,
  /** The workflow input that receives the issue. */
  itemField: z.string().min(1).max(64).default("task"),
  /** `text`: a Markdown summary; `object`: the issue as JSON. */
  itemFormat: z.enum(["text", "object"]).default("text"),
  /** Also put the issue key (ABC-123) into this input, e.g. to link the PR back. */
  keyField: z.string().min(1).max(64).optional(),
  intervalSeconds: z.number().int().min(60).max(86_400).default(120),
});
export type JiraTrigger = z.infer<typeof jiraTriggerSchema>;
