import type { CoreStatus, DatabaseStatus } from "@agentic/contracts";
import { cn } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { useAppInfo, useCoreStatus, useDatabaseStatus } from "./queries";

type DotState = "ok" | "busy" | "error" | "off";

const dotClass: Record<DotState, string> = {
  ok: "bg-success",
  busy: "bg-warning",
  error: "bg-danger",
  off: "bg-fg-subtle",
};

function Dot({ state }: { state: DotState }) {
  return <span aria-hidden className={cn("size-1.5 rounded-full", dotClass[state])} />;
}

function databaseIndicator(status: DatabaseStatus | undefined): { text: string; state: DotState } {
  if (!status) return { text: "…", state: "off" };
  const mode = status.settings.mode === "local" ? "Local" : "Remote";
  switch (status.state) {
    case "ready":
      return { text: `${mode} · ${status.target ?? ""}`, state: "ok" };
    case "starting":
      return { text: `${mode} · starting…`, state: "busy" };
    case "error":
      return { text: `${mode} · unavailable`, state: "error" };
    default:
      return { text: `${mode} · stopped`, state: "off" };
  }
}

function coreIndicator(status: CoreStatus | undefined): { text: string; state: DotState } {
  const restarts = status?.restarts
    ? ` · ${status.restarts} restart${status.restarts > 1 ? "s" : ""}`
    : "";
  switch (status?.state) {
    case "ready":
      return { text: `Core ready${restarts}`, state: "ok" };
    case "starting":
      return { text: "Core starting…", state: "busy" };
    case "error":
      return { text: "Core unavailable", state: "error" };
    default:
      return { text: "Core stopped", state: "off" };
  }
}

/** The active database and Core health. */
export function StatusBar() {
  const info = useAppInfo().data;
  const db = databaseIndicator(useDatabaseStatus().data);
  const coreStatus = useCoreStatus().data;
  const core = coreIndicator(coreStatus);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-sidebar px-3 text-xs text-fg-muted">
      <Link
        to="/settings/database"
        className="flex items-center gap-1.5 hover:text-fg"
        title="Database settings"
      >
        <Dot state={db.state} />
        DB {db.text}
      </Link>
      <Link
        to="/settings/logs"
        className="flex items-center gap-1.5 hover:text-fg"
        title={coreStatus?.error ? `${coreStatus.error} · View logs` : "View logs"}
      >
        <Dot state={core.state} />
        {core.text}
      </Link>
      <div className="flex-1" />
      {info && <span>v{info.version}</span>}
    </footer>
  );
}
