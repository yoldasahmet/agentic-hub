import type { RepoRef } from "@agentic/client";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@agentic/ui";
import { X } from "lucide-react";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { useSubmitReview } from "./queries";

export type LineComment = { path: string; line: number; body: string };
type ReviewEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

/** Submits a review with the line comments picked in the diff. */
export function ReviewForm({
  repo,
  number,
  lineComments,
  onLineCommentsChange,
}: {
  repo: RepoRef;
  number: number;
  lineComments: LineComment[];
  onLineCommentsChange: (next: LineComment[]) => void;
}) {
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [body, setBody] = useState("");
  const submit = useSubmitReview(repo, number);
  const update = (index: number, patch: Partial<LineComment> | null) =>
    onLineCommentsChange(
      lineComments.flatMap((c, i) => (i !== index ? [c] : patch ? [{ ...c, ...patch }] : [])),
    );
  const send = () =>
    submit.mutate(
      { event, body, comments: lineComments.filter((c) => c.body.trim()) },
      {
        onSuccess: () => {
          setBody("");
          onLineCommentsChange([]);
          toast.success("Review submitted");
        },
        onError: (err) => showError(err),
      },
    );
  return (
    <section className="grid gap-2 rounded-card border border-border bg-surface p-4 shadow-1">
      <h3 className="font-medium">Review</h3>
      {lineComments.map((c, index) => (
        <div key={`${c.path}:${c.line}`} className="grid gap-1">
          <div className="flex items-center gap-2 font-mono text-code text-fg-muted">
            {c.path}:{c.line}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove line comment"
              onClick={() => update(index, null)}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
          <Textarea
            aria-label={`Comment on ${c.path} line ${c.line}`}
            rows={2}
            value={c.body}
            onChange={(e) => update(index, { body: e.target.value })}
          />
        </div>
      ))}
      <Textarea
        aria-label="Review summary"
        placeholder="Summary (optional for line comments)"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Select value={event} onValueChange={(v: ReviewEvent) => setEvent(v)}>
          <SelectTrigger aria-label="Review outcome" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMMENT">Comment</SelectItem>
            <SelectItem value="APPROVE">Approve</SelectItem>
            <SelectItem value="REQUEST_CHANGES">Request changes</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="primary" disabled={submit.isPending} onClick={send}>
          Submit review
        </Button>
      </div>
    </section>
  );
}
