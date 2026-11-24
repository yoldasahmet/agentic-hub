import type { RepoRef } from "@agentic/client";
import { Badge, MarkdownText } from "@agentic/ui";
import { showError } from "../../lib/show-error";
import { CommentThread, githubThreadComment } from "./comment-thread";
import { useAddComment, useIssue } from "./queries";

/** An issue: its body, labels, and conversation. */
export function IssueDetail({ repo, number }: { repo: RepoRef; number: number }) {
  const detail = useIssue(repo, number);
  const comment = useAddComment(repo, number);
  if (!detail.data) {
    return <p className="p-6 text-fg-muted">{detail.error?.message ?? "Loading…"}</p>;
  }
  const { issue, comments } = detail.data;
  return (
    <div className="grid content-start gap-4 p-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">
          {issue.title} <span className="text-fg-muted">#{issue.number}</span>
        </h2>
        <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
          <Badge>{issue.state}</Badge> opened by {issue.author?.login ?? "ghost"} ·{" "}
          <a href={issue.url} target="_blank" rel="noreferrer" className="underline">
            on GitHub
          </a>
          {issue.labels.map((l) => (
            <Badge key={l.name}>{l.name}</Badge>
          ))}
        </p>
      </header>
      <div className="rounded-card border border-border bg-surface p-4 shadow-1">
        <MarkdownText text={issue.body || "_No description_"} />
      </div>
      <CommentThread
        comments={comments.map(githubThreadComment)}
        posting={comment.isPending}
        onPost={(body, done) =>
          comment.mutate(body, { onSuccess: done, onError: (err) => showError(err) })
        }
      />
    </div>
  );
}
