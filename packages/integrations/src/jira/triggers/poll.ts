import type { JiraIssue, JiraTrigger } from "@agentic/contracts";
import { z } from "zod";
import type { JiraApi } from "../api/client";
import { searchIssues } from "../api/issues";

/** What a Jira trigger remembers between polls (in its config, so any instance can poll). */
export const jiraPollStateSchema = z.object({
  /** False until the first poll records the baseline; nothing fires before that. */
  primed: z.boolean().default(false),
  /** Issue keys that already fired (or were there at the baseline), newest last, capped. */
  seen: z.array(z.string()).default([]),
});
export type JiraPollState = z.infer<typeof jiraPollStateSchema>;

const MAX_SEEN = 1000;
const PER_POLL = 50;

/**
 * Issues that newly match the trigger's JQL. The first poll only records a
 * baseline, so issues that already match don't start runs when a trigger is
 * added. Newest updates are checked first; an issue fires once.
 */
export async function pollJira(
  api: JiraApi,
  trigger: JiraTrigger,
  state: JiraPollState,
): Promise<{ items: JiraIssue[]; state: JiraPollState }> {
  const page = await searchIssues(api, `${withoutOrder(trigger.jql)} ORDER BY updated DESC`, {
    maxResults: PER_POLL,
  });
  const seen = new Set(state.seen);
  const fresh = page.items.filter((issue) => !seen.has(issue.key)).reverse();
  const next = [...state.seen, ...fresh.map((i) => i.key)].slice(-MAX_SEEN);
  return { items: state.primed ? fresh : [], state: { primed: true, seen: next } };
}

/** The user's ORDER BY is replaced: polling needs the newest updates first. */
function withoutOrder(jql: string): string {
  const stripped = jql.replace(/\s+ORDER\s+BY\s+[\s\S]*$/i, "").trim();
  return stripped ? `(${stripped})` : "";
}

/** The workflow input for one issue: its Markdown summary or the issue itself. */
export function jiraItemInput(trigger: JiraTrigger, issue: JiraIssue): Record<string, unknown> {
  const text = [
    `Jira ${issue.issueType.name} ${issue.key}: ${issue.summary}`,
    issue.url,
    `Status: ${issue.status.name}${issue.labels.length ? ` · Labels: ${issue.labels.join(", ")}` : ""}`,
    "",
    issue.description,
  ]
    .join("\n")
    .trim();
  const input: Record<string, unknown> = {
    [trigger.itemField]: trigger.itemFormat === "object" ? issue : text,
  };
  if (trigger.keyField) input[trigger.keyField] = issue.key;
  return input;
}
