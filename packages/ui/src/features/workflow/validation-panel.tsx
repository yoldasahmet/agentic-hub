import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";
import type { Selection, ValidationIssue } from "./types";

export type ValidationPanelProps = {
  issues: ValidationIssue[];
  onSelect: (selection: Selection) => void;
};

/** The draft's issues, live after each save. Clicking one selects its node or edge. */
export function ValidationPanel({ issues, onSelect }: ValidationPanelProps) {
  const errors = issues.filter((i) => i.severity === "error").length;
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-1.5 px-3 py-2 text-sm text-success-ink">
        <CircleCheck aria-hidden className="size-4" /> Ready to run
      </p>
    );
  }
  return (
    <div className="grid gap-1 p-2">
      <p className="px-1 text-sm text-fg-muted">
        {errors} {errors === 1 ? "error" : "errors"}, {issues.length - errors} warnings
      </p>
      <ul className="grid gap-0.5">
        {issues.map((issue, index) => {
          const Icon = issue.severity === "error" ? CircleAlert : TriangleAlert;
          const target: Selection = issue.node
            ? { kind: "node", id: issue.node }
            : issue.edge
              ? { kind: "edge", id: issue.edge }
              : null;
          return (
            <li key={`${issue.code}:${issue.node ?? issue.edge ?? ""}:${issue.field ?? index}`}>
              <button
                type="button"
                disabled={!target}
                onClick={() => onSelect(target)}
                className="flex w-full items-start gap-2 rounded-control px-1.5 py-1 text-left hover:bg-surface-sunken disabled:hover:bg-transparent"
              >
                <Icon
                  aria-label={issue.severity}
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    issue.severity === "error" ? "text-danger" : "text-warning",
                  )}
                />
                <span className="grid">
                  <span>{issue.message}</span>
                  <span className="font-mono text-xs text-fg-subtle">{issue.code}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
