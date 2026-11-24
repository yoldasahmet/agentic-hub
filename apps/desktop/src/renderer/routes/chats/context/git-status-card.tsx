import { GitBranch } from "lucide-react";
import { useGitStatus } from "../queries";
import { GitDiffDialog } from "./git-diff-dialog";

const MAX_SHOWN = 12;

/** The working dir's branch and changed files, refreshed with every run. */
export function GitStatusCard({
  chatId,
  workingDir,
}: {
  chatId: string;
  workingDir: string | null;
}) {
  const status = useGitStatus(chatId, workingDir !== null);
  if (!workingDir)
    return <p className="text-sm text-fg-muted">Set a working dir to see its git status.</p>;
  if (status.error) return <p className="text-sm text-danger-ink">{status.error.message}</p>;
  const git = status.data;
  if (!git) return <p className="text-sm text-fg-muted">Reading git status…</p>;
  if (!git.repo) return <p className="text-sm text-fg-muted">Not a git repository.</p>;
  return (
    <div className="grid gap-1.5">
      <p className="flex items-center gap-1.5 font-mono text-code">
        <GitBranch aria-hidden className="size-3.5" />
        {git.branch ?? "detached HEAD"}
        {(git.ahead > 0 || git.behind > 0) && (
          <span className="text-fg-muted">
            ↑{git.ahead} ↓{git.behind}
          </span>
        )}
      </p>
      {git.changes.length === 0 ? (
        <p className="text-sm text-fg-muted">No changes.</p>
      ) : (
        <ul className="grid gap-0.5 font-mono text-xs" data-selectable>
          {git.changes.slice(0, MAX_SHOWN).map((change) => (
            <li key={change.path} className="flex gap-2">
              <span className="w-5 shrink-0 text-warning-ink">{change.status}</span>
              <span className="truncate">{change.path}</span>
            </li>
          ))}
          {git.changes.length > MAX_SHOWN && (
            <li className="text-fg-muted">and {git.changes.length - MAX_SHOWN} more</li>
          )}
        </ul>
      )}
      {git.changes.length > 0 && <GitDiffDialog chatId={chatId} count={git.changes.length} />}
    </div>
  );
}
