import type { LogEntry, LogLevel } from "@agentic/contracts";
import { Badge, type BadgeProps, cn, JsonView } from "@agentic/ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const tone: Record<LogLevel, BadgeProps["tone"]> = {
  trace: "neutral",
  debug: "neutral",
  info: "info",
  warn: "warning",
  error: "danger",
  fatal: "danger",
};

const time = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString(undefined, { hour12: false });
};

type Props = { entry: LogEntry; onFilter: (patch: { runId?: string; traceId?: string }) => void };

/** One log line; expands to its fields. Run and trace ids filter the list. */
export function LogRow({ entry, onFilter }: Props) {
  const [open, setOpen] = useState(false);
  const hasData = Object.keys(entry.data).length > 1;
  return (
    <li className="px-3 py-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 text-left"
        title={entry.time}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3 shrink-0 self-center text-fg-subtle",
            open && "rotate-90",
            !hasData && "invisible",
          )}
        />
        <span className="shrink-0 font-mono text-code text-fg-subtle">{time(entry.time)}</span>
        <Badge tone={tone[entry.level]} className="w-12 shrink-0 justify-center uppercase">
          {entry.level}
        </Badge>
        <span className="w-32 shrink-0 truncate font-mono text-code text-fg-muted">
          {entry.module ?? entry.proc}
        </span>
        <span className="min-w-0 flex-1 truncate">{entry.msg}</span>
      </button>
      {open && (
        <div className="grid gap-2 pt-2 pl-5">
          <div className="flex flex-wrap gap-2 text-xs text-fg-muted">
            <span>{entry.proc}</span>
            {entry.runId && (
              <IdChip
                label="run"
                value={entry.runId}
                onClick={() => onFilter({ runId: entry.runId })}
              />
            )}
            {entry.traceId && (
              <IdChip
                label="trace"
                value={entry.traceId}
                onClick={() => onFilter({ traceId: entry.traceId })}
              />
            )}
          </div>
          <JsonView value={entry.data} className="max-h-80" />
        </div>
      )}
    </li>
  );
}

function IdChip({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control bg-surface-sunken px-1.5 font-mono hover:text-fg"
      title={`Show only this ${label}`}
    >
      {label} {value.slice(0, 8)}
    </button>
  );
}
