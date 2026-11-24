import type {
  JiraComment,
  JiraIssue,
  JiraIssueRef,
  JiraStatus,
  JiraUser,
} from "@agentic/contracts";
import { jiraStatusSchema } from "@agentic/contracts";
import { adfToMarkdown } from "../adf/to-markdown";
import type { RawComment, RawIssue, RawRef, RawStatus, RawUser } from "./raw";

export const toUser = (u: RawUser | null | undefined): JiraUser | null =>
  u
    ? {
        accountId: u.accountId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrls?.["48x48"] ?? null,
      }
    : null;

export const toStatus = (s: RawStatus | undefined): JiraStatus =>
  jiraStatusSchema.parse({ name: s?.name ?? "Unknown", category: s?.statusCategory?.key });

const toRef = (r: RawRef): JiraIssueRef => ({
  key: r.key,
  summary: r.fields.summary,
  status: toStatus(r.fields.status),
});

export function toIssue(raw: RawIssue, browseUrl: (key: string) => string): JiraIssue {
  const f = raw.fields;
  return {
    id: raw.id,
    key: raw.key,
    summary: f.summary,
    description: adfToMarkdown(f.description),
    status: toStatus(f.status),
    issueType: f.issuetype,
    priority: f.priority?.name ?? null,
    assignee: toUser(f.assignee),
    reporter: toUser(f.reporter),
    labels: f.labels,
    parent: f.parent ? toRef(f.parent) : null,
    subtasks: f.subtasks.map(toRef),
    created: f.created,
    updated: f.updated,
    url: browseUrl(raw.key),
  };
}

export const toComment = (c: RawComment): JiraComment => ({
  id: c.id,
  author: toUser(c.author),
  body: adfToMarkdown(c.body),
  created: c.created,
});
