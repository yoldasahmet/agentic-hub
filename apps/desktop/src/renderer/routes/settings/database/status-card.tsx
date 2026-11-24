import type { DatabaseStatus, DbState } from "@agentic/contracts";
import { Button, cn, toast } from "@agentic/ui";
import { CircleCheck, CircleDashed, CircleX, LoaderCircle, type LucideIcon } from "lucide-react";
import { showError } from "../../../lib/show-error";
import { useMigrateDatabase } from "./queries";

const stateStyles: Record<DbState, { label: string; icon: LucideIcon; tone: string }> = {
  ready: { label: "Connected", icon: CircleCheck, tone: "bg-success-tint text-success-ink" },
  starting: { label: "Starting", icon: LoaderCircle, tone: "bg-info-tint text-info-ink" },
  error: { label: "Unavailable", icon: CircleX, tone: "bg-danger-tint text-danger-ink" },
  stopped: { label: "Stopped", icon: CircleDashed, tone: "bg-surface-sunken text-fg-muted" },
};

/** The active database: state, where it is, server version, and migrations. */
export function StatusCard({ status }: { status: DatabaseStatus }) {
  const migrate = useMigrateDatabase();
  const { label, icon: Icon, tone } = stateStyles[status.state];
  const rows = [
    ["Mode", status.settings.mode === "local" ? "Local service" : "Remote team DB"],
    ["Server", status.target],
    ["Postgres", status.serverVersion],
    ["Migrations", status.migrationsApplied?.toString()],
  ] as const;

  const applyMigrations = () =>
    migrate.mutate(undefined, {
      onSuccess: (next) => toast.success(`Database is up to date (${next.migrationsApplied})`),
      onError: (err) => showError(err),
    });

  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            tone,
          )}
        >
          <Icon
            aria-hidden
            className={cn("size-3", status.state === "starting" && "animate-spin")}
          />
          {label}
        </span>
        <Button
          size="sm"
          onClick={applyMigrations}
          disabled={status.state !== "ready" || migrate.isPending}
        >
          Apply migrations
        </Button>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
        {rows.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-fg-muted">{name}</dt>
            <dd data-selectable className={name === "Mode" ? undefined : "font-mono text-code"}>
              {value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
      {status.error && (
        <p role="alert" className="rounded-control bg-danger-tint p-2 text-sm text-danger-ink">
          {status.error}
        </p>
      )}
    </div>
  );
}
