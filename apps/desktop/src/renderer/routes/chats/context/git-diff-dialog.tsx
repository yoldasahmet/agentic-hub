import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DiffViewer,
  splitUnifiedDiff,
} from "@agentic/ui";
import { useState } from "react";
import { useGitDiff } from "../queries";

/** The working dir's uncommitted changes, rendered like a pull request's files. */
export function GitDiffDialog({ chatId, count }: { chatId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const diff = useGitDiff(chatId, open);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        View diff ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Uncommitted changes</DialogTitle>
          </DialogHeader>
          {diff.data ? (
            <div className="grid gap-2">
              {diff.data.truncated && (
                <p className="text-sm text-warning-ink">
                  The diff is large; only its start is shown.
                </p>
              )}
              <DiffViewer files={splitUnifiedDiff(diff.data.diff)} />
            </div>
          ) : (
            <p className="text-fg-muted">{diff.error?.message ?? "Reading the diff…"}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
