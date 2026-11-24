import type { GithubTrigger } from "@agentic/contracts";
import { z } from "zod";
import type { GithubApi } from "../api/client";
import { listIssues } from "../api/issues";
import { reviewRequests } from "../api/pulls";
import { splitRepo } from "../api/repos";

/** What a GitHub trigger remembers between polls (in its config, so any instance can poll). */
export const githubPollStateSchema = z.object({
  /** Set by the first poll; until then nothing fires (no backlog storm). */
  since: z.string().nullable().default(null),
  /** Items that already fired, newest last, capped. */
  seen: z.array(z.string()).default([]),
});
export type GithubPollState = z.infer<typeof githubPollStateSchema>;

export type TriggerItem = {
  key: string;
  kind: "issue" | "pull";
  repo: string;
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
  author: string | null;
};

const MAX_SEEN = 500;

/**
 * Finds the items a trigger hasn't fired for. The first poll only records
 * a baseline: issues that already exist, or already carry the label, don't
 * start runs when a trigger is created.
 */
export async function pollGithub(
  api: GithubApi,
  trigger: GithubTrigger,
  state: GithubPollState,
): Promise<{ items: TriggerItem[]; state: GithubPollState }> {
  const now = new Date().toISOString();
  const found = await candidates(api, trigger, state.since);
  const seen = new Set(state.seen);
  const fresh = found.filter((item) => !seen.has(item.key));
  const next = [...state.seen, ...fresh.map((i) => i.key)].slice(-MAX_SEEN);
  return { items: state.since === null ? [] : fresh, state: { since: now, seen: next } };
}

async function candidates(
  api: GithubApi,
  trigger: GithubTrigger,
  since: string | null,
): Promise<TriggerItem[]> {
  const ref = splitRepo(trigger.repo);
  if (trigger.event === "review.requested") {
    const pulls = await reviewRequests(api, trigger.repo);
    return pulls.map((p) => ({
      key: `pull#${p.number}`,
      kind: "pull",
      repo: trigger.repo,
      number: p.number,
      title: p.title,
      body: p.body ?? "",
      url: p.html_url,
      labels: p.labels.map((l) => l.name ?? "").filter(Boolean),
      author: p.user?.login ?? null,
    }));
  }
  const page = await listIssues(api, ref, {
    state: "open",
    labels: trigger.label || undefined,
    since: since ?? undefined,
    sort: trigger.event === "issue.opened" ? "created" : "updated",
    perPage: 50,
  });
  const issues =
    trigger.event === "issue.opened" && since
      ? page.items.filter((i) => i.createdAt >= since)
      : page.items;
  return issues.map((i) => ({
    key: `issue#${i.number}`,
    kind: "issue",
    repo: trigger.repo,
    number: i.number,
    title: i.title,
    body: i.body,
    url: i.url,
    labels: i.labels.map((l) => l.name),
    author: i.author?.login ?? null,
  }));
}

/** The workflow input for one item: its Markdown summary or the item itself. */
export function itemInput(trigger: GithubTrigger, item: TriggerItem): Record<string, unknown> {
  const { key: _key, ...data } = item;
  const kind = item.kind === "pull" ? "pull request" : "issue";
  const text =
    `GitHub ${kind} ${item.repo}#${item.number}: ${item.title}\n${item.url}\n\n${item.body}`.trim();
  const input: Record<string, unknown> = {
    [trigger.itemField]: trigger.itemFormat === "object" ? data : text,
  };
  if (trigger.repoField) input[trigger.repoField] = item.repo;
  return input;
}
