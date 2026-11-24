import type { ChatAttachment } from "@agentic/contracts";
import { FileText, GitPullRequest, Image, SquareKanban, X } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = { attachment: ChatAttachment; onRemove?: () => void; className?: string };

/** A file or a GitHub/Jira item sent with a message; removable in the composer. */
export function AttachmentChip({ attachment, onRemove, className }: Props) {
  const Icon =
    attachment.kind === "item"
      ? attachment.source === "github"
        ? GitPullRequest
        : SquareKanban
      : attachment.mediaType.startsWith("image/")
        ? Image
        : FileText;
  const label = attachment.kind === "item" ? attachment.ref : attachment.name;
  const title = attachment.kind === "item" ? (attachment.title ?? attachment.ref) : attachment.path;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-64 items-center gap-1 rounded-control border border-border bg-surface px-2 py-0.5 text-sm",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="-mr-1 rounded p-0.5 text-fg-muted hover:bg-surface-sunken hover:text-fg"
        >
          <X aria-hidden className="size-3" />
        </button>
      )}
    </span>
  );
}
