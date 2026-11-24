import type { DatabaseStatus } from "@agentic/contracts";
import { Button, toast } from "@agentic/ui";
import { showError } from "../../../lib/show-error";
import { useBackupDatabase, useRestoreDatabase } from "./queries";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Snapshots of the local database (P18.2). Both restart the database for a few seconds. */
export function BackupCard({ status }: { status: DatabaseStatus }) {
  const backup = useBackupDatabase();
  const restore = useRestoreDatabase();
  const busy = backup.isPending || restore.isPending || status.state === "starting";

  const backUp = () =>
    backup.mutate(undefined, {
      onSuccess: ({ path, bytes }) => {
        if (path) toast.success(`Backed up ${formatSize(bytes)} to ${path}`);
      },
      onError: (err) => showError(err),
    });
  const restoreBackup = () =>
    restore.mutate(undefined, {
      onSuccess: ({ restored }) => {
        if (restored) toast.success("Restored the local database");
      },
      onError: (err) => showError(err),
    });

  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
      <div className="grid gap-1">
        <h3 className="font-medium">Backup</h3>
        <p className="text-fg-muted">
          Save the whole local database to one file, or replace it with a saved one. The database
          restarts for a few seconds, so running work pauses and resumes.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={backUp} disabled={busy}>
          Back up…
        </Button>
        <Button size="sm" variant="ghost" onClick={restoreBackup} disabled={busy}>
          Restore…
        </Button>
      </div>
    </div>
  );
}
