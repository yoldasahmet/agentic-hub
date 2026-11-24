import type { RunEvent } from "@agentic/contracts";
import { AlertTriangle, Bot, ChevronRight, Hand, Wrench } from "lucide-react";
import { JsonView } from "../state-inspector/json-view";
import { StatusPill } from "../status-pill";
import { foldEvents, type StreamItem } from "./fold-events";

export type EventStreamProps = {
  events: RunEvent[];
  /** Display names by provider id. */
  providerNames?: Record<string, string>;
};

/**
 * A run's live events: status changes, model attempts, streamed text,
 * collapsed thinking, compact tool calls that expand, and errors. Text
 * grows in place, so streaming causes no layout jumps above it.
 */
export function EventStream({ events, providerNames = {} }: EventStreamProps) {
  const items = foldEvents(events);
  if (items.length === 0) return <p className="text-fg-muted">Waiting for events…</p>;
  return (
    <ol className="grid gap-2" aria-live="polite">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items only append, so positions are stable
        <li key={index}>
          <Item item={item} providerNames={providerNames} />
        </li>
      ))}
    </ol>
  );
}

function Item({
  item,
  providerNames,
}: {
  item: StreamItem;
  providerNames: Record<string, string>;
}) {
  switch (item.kind) {
    case "status":
      return (
        <div className="flex items-center gap-2">
          <StatusPill status={item.status} />
          {item.error && <span className="text-sm text-danger-ink">{item.error.message}</span>}
        </div>
      );
    case "attempt":
      return (
        <p className="flex items-center gap-1.5 text-sm text-fg-muted">
          <Bot aria-hidden className="size-3.5" />
          {item.attempt > 1 ? "Falling back to" : "Calling"}{" "}
          {providerNames[item.model.providerId] ?? item.model.providerId} · {item.model.model}
        </p>
      );
    case "text":
      return (
        <p data-selectable className="whitespace-pre-wrap font-serif text-prose">
          {item.text}
        </p>
      );
    case "thinking":
      return (
        <Details summary="Thinking">
          <p className="whitespace-pre-wrap text-fg-muted">{item.text}</p>
        </Details>
      );
    case "tool":
      return (
        <Details
          summary={
            <>
              <Wrench aria-hidden className="size-3.5" /> {item.name}
            </>
          }
        >
          <JsonView value={{ input: item.input, output: item.output }} />
        </Details>
      );
    case "error":
      return (
        <p className="flex items-center gap-1.5 text-sm text-danger-ink">
          <AlertTriangle aria-hidden className="size-3.5" /> {item.message}
        </p>
      );
    case "gate":
      return (
        <p className="flex items-center gap-1.5 text-sm text-warning-ink">
          <Hand aria-hidden className="size-3.5" /> Waiting for your answer
        </p>
      );
    case "node":
      return <p className="font-mono text-xs text-fg-subtle">{item.node} finished</p>;
    case "custom":
      return <JsonView value={item.data} className="text-xs" />;
  }
}

function Details({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-control border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1 text-sm text-fg-muted">
        <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="border-t border-border p-2.5">{children}</div>
    </details>
  );
}
