import { cn } from "../../lib/cn";
import { diffJson } from "./json-diff";

const marks = {
  added: { sign: "+", tone: "text-success-ink" },
  removed: { sign: "−", tone: "text-danger-ink" },
  changed: { sign: "~", tone: "text-warning-ink" },
} as const;

const short = (value: unknown) => JSON.stringify(value) ?? "undefined";

/** What changed between two values: a checkpoint and its parent, or two runs' outputs. */
export function StateDiff({
  before,
  after,
  emptyText = "No change from the parent.",
}: {
  before: unknown;
  after: unknown;
  emptyText?: string;
}) {
  const entries = diffJson(before ?? {}, after ?? {});
  if (entries.length === 0) return <p className="p-3 text-fg-muted">{emptyText}</p>;
  return (
    <ul
      data-selectable
      className="grid gap-1 rounded-control bg-surface-sunken p-3 font-mono text-code"
    >
      {entries.map((entry) => {
        const { sign, tone } = marks[entry.kind];
        return (
          <li key={entry.path} className="flex gap-2">
            <span aria-hidden className={cn("w-3 shrink-0", tone)}>
              {sign}
            </span>
            <span className="min-w-0 break-all">
              <span className="text-fg-muted">{entry.path}: </span>
              {entry.kind === "added" && short(entry.after)}
              {entry.kind === "removed" && <s className="text-fg-muted">{short(entry.before)}</s>}
              {entry.kind === "changed" && (
                <>
                  <s className="text-fg-muted">{short(entry.before)}</s> → {short(entry.after)}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
