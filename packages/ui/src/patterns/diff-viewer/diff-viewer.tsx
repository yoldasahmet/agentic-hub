import { cn } from "../../lib/cn";
import { DiffFileCard, statusTone } from "./diff-file";
import type { DiffFile } from "./parse-patch";

type Props = {
  files: DiffFile[];
  onComment?: (path: string, line: number) => void;
  /** Hides the file list, for narrow spots like the chat context panel. */
  compact?: boolean;
  className?: string;
};

const domId = (name: string) => `diff-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;

/** Files of a diff with a jump list (ported from the reference `pull-diff`). */
export function DiffViewer({ files, onComment, compact, className }: Props) {
  if (files.length === 0) return <p className="text-sm text-fg-muted">No changes.</p>;
  return (
    <div className={cn("grid gap-3", !compact && "lg:grid-cols-[240px_minmax(0,1fr)]", className)}>
      {!compact && (
        <nav aria-label="Changed files" className="grid content-start gap-0.5 lg:sticky lg:top-0">
          {files.map((file) => (
            <button
              key={file.filename}
              type="button"
              onClick={() =>
                document.getElementById(domId(file.filename))?.scrollIntoView({ block: "start" })
              }
              className="flex items-center gap-2 rounded-control px-2 py-1 text-left text-sm hover:bg-surface-sunken"
            >
              <span className={cn("size-1.5 rounded-full bg-current", statusTone[file.status])} />
              <span className="flex-1 truncate font-mono text-code">{file.filename}</span>
              <span className="text-success-ink">+{file.additions}</span>
              <span className="text-danger-ink">−{file.deletions}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="grid min-w-0 content-start gap-3">
        {files.map((file) => (
          <div key={file.filename} id={domId(file.filename)} className="scroll-mt-2">
            <DiffFileCard file={file} onComment={onComment} />
          </div>
        ))}
      </div>
    </div>
  );
}
