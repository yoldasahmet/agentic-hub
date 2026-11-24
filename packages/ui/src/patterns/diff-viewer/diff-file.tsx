import { ChevronDown, ChevronRight, MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { type DiffFile, type DiffLine, parsePatch } from "./parse-patch";

const rowClass: Record<DiffLine["kind"], string> = {
  context: "",
  add: "bg-success-tint",
  del: "bg-danger-tint",
  hunk: "bg-info-tint text-info-ink",
};
const prefix: Record<DiffLine["kind"], string> = { context: " ", add: "+", del: "-", hunk: "" };

export const statusTone: Record<string, string> = {
  added: "text-success-ink",
  removed: "text-danger-ink",
  renamed: "text-info-ink",
  modified: "text-warning-ink",
};

type Props = {
  file: DiffFile;
  /** Shows a comment button on new-side lines (pull request review comments). */
  onComment?: (path: string, line: number) => void;
};

/** One file of a diff: a collapsible card with old/new line numbers. */
export function DiffFileCard({ file, onComment }: Props) {
  const [open, setOpen] = useState(true);
  const lines = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch]);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border-b border-border bg-surface-sunken px-3 py-2 text-left"
      >
        <Chevron className="size-4 text-fg-muted" aria-hidden />
        <span className="flex-1 truncate font-mono text-code">
          {file.previousFilename ? `${file.previousFilename} → ` : ""}
          {file.filename}
        </span>
        <span className={cn("text-sm", statusTone[file.status] ?? "text-fg-muted")}>
          {file.status}
        </span>
        <span className="text-sm text-success-ink">+{file.additions}</span>
        <span className="text-sm text-danger-ink">−{file.deletions}</span>
      </button>
      {open && (
        <div className="overflow-x-auto" data-selectable>
          {lines.length === 0 ? (
            <p className="px-3 py-2 text-sm text-fg-muted">No text diff (binary or too large).</p>
          ) : (
            <table className="w-full border-collapse font-mono text-code">
              <tbody>
                {lines.map((line, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
                  <tr key={index} className={cn("group", rowClass[line.kind])}>
                    <td className="w-12 select-none px-2 text-right text-fg-subtle">
                      {line.oldNo ?? ""}
                    </td>
                    <td className="w-12 select-none px-2 text-right text-fg-subtle">
                      {line.newNo ?? ""}
                    </td>
                    <td className="relative whitespace-pre px-3">
                      <span className="select-none text-fg-subtle">{prefix[line.kind]} </span>
                      {line.text}
                      {onComment && line.newNo !== null && (
                        <button
                          type="button"
                          aria-label={`Comment on line ${line.newNo}`}
                          onClick={() => onComment(file.filename, line.newNo ?? 0)}
                          className="absolute top-0 right-2 rounded-control bg-surface px-1 text-fg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <MessageSquarePlus className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
