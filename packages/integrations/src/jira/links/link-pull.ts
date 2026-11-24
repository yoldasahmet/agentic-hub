import { jiraKeysIn, jiraKeysInBranch } from "@agentic/contracts";
import { addRemoteLink } from "../api/comments";
import type { JiraConnection } from "../auth/connection";

/** More keys than this in one PR is noise, not a link list. */
const MAX_KEYS = 10;

export type OpenedPull = {
  repo: string;
  number: number;
  title: string;
  body: string;
  head: string;
  url: string;
};

/**
 * Links a pull request on every Jira issue its branch, title, or body
 * names. Best effort: unknown keys and a missing Jira connection are
 * skipped, so opening the PR never fails because of Jira.
 */
export async function linkPullToJira(
  conn: JiraConnection,
  workspaceId: string,
  pull: OpenedPull,
): Promise<string[]> {
  if (!conn.hasToken()) return [];
  const keys = [
    ...new Set([...jiraKeysInBranch(pull.head), ...jiraKeysIn(pull.title, pull.body)]),
  ].slice(0, MAX_KEYS);
  if (keys.length === 0) return [];
  const api = await conn.api(workspaceId).catch(() => undefined);
  if (!api) return [];
  const title = `${pull.repo}#${pull.number}: ${pull.title}`;
  const linked = await Promise.all(
    keys.map((key) =>
      addRemoteLink(api, key, { url: pull.url, title }).then(
        () => key,
        () => undefined,
      ),
    ),
  );
  return linked.filter((key) => key !== undefined);
}
