import type { RepoRef } from "@agentic/client";
import {
  Badge,
  DiffViewer,
  MarkdownText,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@agentic/ui";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { JiraKeyLinks } from "../jira/jira-key-links";
import { CommentThread, githubThreadComment } from "./comment-thread";
import { useAddComment, usePull, usePullFiles } from "./queries";
import { type LineComment, ReviewForm } from "./review-form";

const reviewTone = { APPROVED: "approved", CHANGES_REQUESTED: "changes requested" } as const;

/** A pull request: conversation and reviews, and the changed files to comment on. */
export function PullDetail({ repo, number }: { repo: RepoRef; number: number }) {
  const detail = usePull(repo, number);
  const files = usePullFiles(repo, number);
  const comment = useAddComment(repo, number);
  const [tab, setTab] = useState("conversation");
  const [lineComments, setLineComments] = useState<LineComment[]>([]);
  if (!detail.data) {
    return <p className="p-6 text-fg-muted">{detail.error?.message ?? "Loading…"}</p>;
  }
  const { pull, comments, reviews, reviewComments } = detail.data;
  const addLineComment = (path: string, line: number) => {
    if (!lineComments.some((c) => c.path === path && c.line === line)) {
      setLineComments([...lineComments, { path, line, body: "" }]);
    }
    setTab("conversation");
  };
  const conversation = [...comments, ...reviewComments].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <div className="grid content-start gap-4 p-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">
          {pull.title} <span className="text-fg-muted">#{pull.number}</span>
        </h2>
        <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
          <Badge>{pull.draft ? "draft" : pull.state}</Badge>
          <span className="font-mono text-code">
            {pull.head} → {pull.base}
          </span>
          · {pull.author?.login ?? "ghost"} · +{pull.additions ?? 0} −{pull.deletions ?? 0} ·{" "}
          <a href={pull.url} target="_blank" rel="noreferrer" className="underline">
            on GitHub
          </a>
        </p>
        <JiraKeyLinks branch={pull.head} texts={[pull.title, pull.body]} />
        {reviews.length > 0 && (
          <p className="flex flex-wrap gap-1 text-sm text-fg-muted">
            {reviews.map((r) => (
              <Badge key={r.id}>
                {r.author?.login}: {reviewTone[r.state as keyof typeof reviewTone] ?? "commented"}
              </Badge>
            ))}
          </p>
        )}
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="files">Files changed ({files.data?.length ?? "…"})</TabsTrigger>
        </TabsList>
        <TabsContent value="conversation" className="grid gap-4 pt-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-1">
            <MarkdownText text={pull.body || "_No description_"} />
          </div>
          <CommentThread
            comments={conversation.map(githubThreadComment)}
            posting={comment.isPending}
            onPost={(body, done) =>
              comment.mutate(body, { onSuccess: done, onError: (err) => showError(err) })
            }
          />
          {pull.state === "open" && (
            <ReviewForm
              repo={repo}
              number={number}
              lineComments={lineComments}
              onLineCommentsChange={setLineComments}
            />
          )}
        </TabsContent>
        <TabsContent value="files" className="pt-4">
          {files.data ? (
            <DiffViewer
              files={files.data}
              onComment={pull.state === "open" ? addLineComment : undefined}
            />
          ) : (
            <p className="text-fg-muted">{files.error?.message ?? "Loading…"}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
