import { z } from "zod";
import { repoFullNameSchema } from "./entities";

/** What a GitHub trigger watches. Polled, so it works without a public webhook URL. */
export const githubTriggerEventSchema = z.enum([
  "issue.opened",
  "issue.labeled",
  "review.requested",
]);
export type GithubTriggerEvent = z.infer<typeof githubTriggerEventSchema>;

export const githubTriggerSchema = z.object({
  repo: repoFullNameSchema,
  event: githubTriggerEventSchema,
  /** Required for `issue.labeled`; narrows `issue.opened` when set. */
  label: z.string().trim().max(100).optional(),
  /** The workflow input that receives the issue or pull request. */
  itemField: z.string().min(1).max(64).default("task"),
  /** `text`: a Markdown summary; `object`: the item as JSON. */
  itemFormat: z.enum(["text", "object"]).default("text"),
  /** Also put `owner/name` into this input, e.g. the repo a worktree is made from. */
  repoField: z.string().min(1).max(64).optional(),
  intervalSeconds: z.number().int().min(60).max(86_400).default(120),
});
export type GithubTrigger = z.infer<typeof githubTriggerSchema>;
