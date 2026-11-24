import { Badge, MarkdownText } from "@agentic/ui";
import { GitPullRequest } from "lucide-react";
import { showError } from "../../lib/show-error";
import { CommentThread, type ThreadComment } from "../github/comment-thread";
import { useJiraComment, useJiraIssue } from "./queries";
import { StatusBadge } from "./status-badge";
import { TransitionMenu } from "./transition-menu";

/** An issue: its description, sub-tasks, linked PRs, transitions, and comments. */
export function IssueDetail({
  issueKey,
  onOpen,
}: {
  issueKey: string;
  onOpen: (key: string) => void;
}) {
  const detail = useJiraIssue(issueKey);
  const comment = useJiraComment(issueKey);
  if (!detail.data) {
    return <p className="p-6 text-fg-muted">{detail.error?.message ?? "Loading…"}</p>;
  }
  const { issue, comments, transitions, links } = detail.data;
  const thread: ThreadComment[] = comments.map((c) => ({
    id: c.id,
    author: c.author?.displayName ?? "Unknown",
    body: c.body,
    createdAt: c.created,
  }));
  return (
    <div className="grid content-start gap-4 p-6">
      <header className="grid gap-2">
        <h2 className="font-serif text-xl">
          {issue.summary} <span className="font-mono text-code text-fg-muted">{issue.key}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
          <TransitionMenu issueKey={issue.key} status={issue.status} transitions={transitions} />
          {issue.issueType.name}
          {issue.priority && <> · {issue.priority}</>} ·{" "}
          {issue.assignee?.displayName ?? "Unassigned"} ·{" "}
          <a href={issue.url} target="_blank" rel="noreferrer" className="underline">
            in Jira
          </a>
          {issue.labels.map((l) => (
            <Badge key={l}>{l}</Badge>
          ))}
        </div>
        {issue.parent && (
          <p className="text-sm text-fg-muted">
            Sub-task of{" "}
            <button
              type="button"
              className="underline"
              onClick={() => onOpen(issue.parent?.key ?? "")}
            >
              {issue.parent.key} {issue.parent.summary}
            </button>
          </p>
        )}
      </header>
      <div className="rounded-card border border-border bg-surface p-4 shadow-1">
        <MarkdownText text={issue.description || "_No description_"} />
      </div>
      {issue.subtasks.length > 0 && (
        <section className="grid gap-1">
          <h3 className="font-medium">Sub-tasks</h3>
          {issue.subtasks.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onOpen(s.key)}
              className="flex items-center gap-2 rounded-control px-2 py-1 text-left hover:bg-surface-sunken"
            >
              <span className="font-mono text-code text-fg-muted">{s.key}</span>
              <span className="flex-1">{s.summary}</span>
              <StatusBadge status={s.status} />
            </button>
          ))}
        </section>
      )}
      {links.length > 0 && (
        <section className="grid gap-1">
          <h3 className="font-medium">Links</h3>
          {links.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-accent-ink hover:underline"
            >
              <GitPullRequest className="size-4" aria-hidden /> {l.title || l.url}
            </a>
          ))}
        </section>
      )}
      <CommentThread
        comments={thread}
        posting={comment.isPending}
        onPost={(body, done) =>
          comment.mutate(body, { onSuccess: done, onError: (err) => showError(err) })
        }
      />
    </div>
  );
}
