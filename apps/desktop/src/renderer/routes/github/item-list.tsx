import type { GithubIssue, GithubPull } from "@agentic/contracts";
import { Badge, cn } from "@agentic/ui";
import { CircleDot, GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";

export type ListItem = { kind: "issue"; item: GithubIssue } | { kind: "pull"; item: GithubPull };

function ItemIcon({ entry }: { entry: ListItem }) {
  const { state } = entry.item;
  if (entry.kind === "issue") {
    return (
      <CircleDot
        className={cn("size-4", state === "open" ? "text-success-ink" : "text-fg-muted")}
        aria-hidden
      />
    );
  }
  const Icon =
    state === "merged" ? GitMerge : state === "closed" ? GitPullRequestClosed : GitPullRequest;
  return (
    <Icon
      className={cn("size-4", state === "open" ? "text-success-ink" : "text-fg-muted")}
      aria-hidden
    />
  );
}

/** Issues or pull requests of a repo, newest activity first. */
export function ItemList({
  items,
  selected,
  onSelect,
}: {
  items: ListItem[];
  selected: number | undefined;
  onSelect: (number: number) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((entry) => (
        <li key={entry.item.number}>
          <button
            type="button"
            onClick={() => onSelect(entry.item.number)}
            aria-current={selected === entry.item.number}
            className="grid w-full gap-1 px-3 py-2 text-left hover:bg-surface-sunken aria-[current=true]:bg-accent-tint"
          >
            <span className="flex items-start gap-2">
              <ItemIcon entry={entry} />
              <span className="flex-1 leading-snug">{entry.item.title}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1 pl-6 text-sm text-fg-muted">
              #{entry.item.number} · {entry.item.author?.login ?? "ghost"}
              {entry.kind === "pull" && entry.item.draft && <Badge>draft</Badge>}
              {entry.item.labels.slice(0, 3).map((l) => (
                <Badge key={l.name}>{l.name}</Badge>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
