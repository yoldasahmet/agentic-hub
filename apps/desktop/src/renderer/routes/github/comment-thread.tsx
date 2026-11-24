import type { GithubComment } from "@agentic/contracts";
import { Button, MarkdownText, Textarea, toast } from "@agentic/ui";
import { useState } from "react";

/** One comment of any source (GitHub, Jira); `location` is a diff line, if any. */
export type ThreadComment = {
  id: string | number;
  author: string;
  body: string;
  createdAt: string;
  location?: string;
};

export const githubThreadComment = (c: GithubComment): ThreadComment => ({
  id: c.id,
  author: c.author?.login ?? "ghost",
  body: c.body,
  createdAt: c.createdAt,
  location: c.path ? `${c.path}${c.line ? `:${c.line}` : ""}` : undefined,
});

function CommentCard({ comment }: { comment: ThreadComment }) {
  return (
    <article className="rounded-card border border-border bg-surface shadow-1">
      <header className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm text-fg-muted">
        <span className="font-medium text-fg">{comment.author}</span>
        {comment.location && <span className="font-mono text-code">{comment.location}</span>}
        <span className="ml-auto">{new Date(comment.createdAt).toLocaleString()}</span>
      </header>
      <div className="px-3 py-2">
        <MarkdownText text={comment.body || "_No text_"} />
      </div>
    </article>
  );
}

/** A conversation plus a box to add to it (⌘↵ posts). */
export function CommentThread({
  comments,
  onPost,
  posting,
}: {
  comments: ThreadComment[];
  onPost: (body: string, done: () => void) => void;
  posting: boolean;
}) {
  const [body, setBody] = useState("");
  const post = () => {
    if (!body.trim()) return toast.error("Write a comment first");
    onPost(body.trim(), () => setBody(""));
  };
  return (
    <div className="grid gap-3">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}
      <Textarea
        aria-label="Comment"
        placeholder="Leave a comment (Markdown)"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.metaKey && post()}
      />
      <div className="flex justify-end">
        <Button variant="primary" disabled={posting} onClick={post}>
          Comment
        </Button>
      </div>
    </div>
  );
}
