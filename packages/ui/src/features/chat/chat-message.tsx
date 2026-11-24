import type { ChatMessage } from "@agentic/contracts";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { EntityAvatar } from "../../patterns/entity-avatar";
import { MarkdownText } from "../../patterns/output-view/markdown-output";
import { OutputView } from "../../patterns/output-view/output-view";
import { UsageSummary } from "../../patterns/usage-summary";
import { Button } from "../../primitives/button";
import { AttachmentChip } from "./attachment-chip";
import { targetIdentity } from "./target-identity";

export type ChatMessageViewProps = {
  message: ChatMessage;
  /** Sends the question again after a failed answer. */
  onRetry?: () => void;
};

/**
 * One message. Questions sit right in a card; answers sit left under the
 * target's avatar, rendered by the target's output format, with usage.
 */
export function ChatMessageView({ message, onRetry }: ChatMessageViewProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto grid max-w-[85%] justify-items-end gap-1.5">
        {message.text && (
          <p
            data-selectable
            className="rounded-card border border-border bg-surface px-3.5 py-2 whitespace-pre-wrap shadow-1"
          >
            {message.text}
          </p>
        )}
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {message.attachments.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: attachments never reorder
              <AttachmentChip key={i} attachment={a} />
            ))}
          </div>
        )}
      </div>
    );
  }
  const identity = targetIdentity(message.target);
  const onlyText = message.output && isOnlyText(message.output.value);
  return (
    <div className="flex gap-3">
      <EntityAvatar color={identity.color} icon={identity.icon} size="md" />
      <div className="grid min-w-0 flex-1 gap-2">
        <span className="text-sm font-medium text-fg-muted">
          {identity.name}
          {message.target?.version ? ` · v${message.target.version}` : ""}
        </span>
        {message.error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-danger-tint px-3 py-2 text-danger-ink">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{message.error.message}</span>
            {onRetry && (
              <Button size="sm" variant="ghost" onClick={onRetry}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            )}
          </div>
        ) : message.output && !onlyText ? (
          <OutputView
            format={message.output.format}
            value={message.output.value}
            schema={message.output.schema}
          />
        ) : (
          <MarkdownText text={message.text} />
        )}
        {message.report && (
          <UsageSummary
            usage={message.report.usage}
            costUsd={message.report.costUsd}
            durationMs={message.report.durationMs}
            className="text-xs"
          />
        )}
      </div>
    </div>
  );
}

/** Free-text answers (`{ text }`) read as prose rather than as a one-field record. */
function isOnlyText(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && typeof value.text === "string";
}
