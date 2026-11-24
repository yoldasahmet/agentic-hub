import type { JiraIssue } from "@agentic/contracts";
import { Badge } from "@agentic/ui";
import { StatusBadge } from "./status-badge";

/** Issues of a search, newest updates first. */
export function IssueList({
  issues,
  selected,
  onSelect,
}: {
  issues: JiraIssue[];
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {issues.map((issue) => (
        <li key={issue.key}>
          <button
            type="button"
            onClick={() => onSelect(issue.key)}
            aria-current={selected === issue.key}
            className="grid w-full gap-1 px-3 py-2 text-left hover:bg-surface-sunken aria-[current=true]:bg-accent-tint"
          >
            <span className="leading-snug">{issue.summary}</span>
            <span className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
              <span className="font-mono text-code">{issue.key}</span> · {issue.issueType.name}
              <StatusBadge status={issue.status} />
              {issue.labels.slice(0, 2).map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
