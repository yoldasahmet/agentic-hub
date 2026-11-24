import type { LogEntry } from "@agentic/contracts";
import { Button, EmptyState } from "@agentic/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ClipboardCopy, FolderOpen, ScrollText } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { LogFilters } from "./log-filters";
import { LogRow } from "./log-row";
import { openLogFolder, useCopyDiagnostics, useLogs } from "./queries";
import type { LogSearch } from "./search";

/** Content keys stay stable while live refreshes add lines on top (expanded rows stay open). */
function withKeys(entries: LogEntry[]): Array<{ key: string; entry: LogEntry }> {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = `${entry.time}|${entry.proc}|${String(entry.data.pid)}|${entry.msg}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n === 0 ? base : `${base}#${n}`, entry };
  });
}

/** Settings → Logs: main's and Core's logs, filtered by level, module, run, or trace. */
export function LogsPage() {
  const search = useSearch({ from: "/settings/logs" });
  const navigate = useNavigate({ from: "/settings/logs" });
  const [text, setText] = useState("");
  const [live, setLive] = useState(true);
  const deferred = useDeferredValue(text.trim());
  const logs = useLogs({ ...search, search: deferred || undefined }, live);
  const copy = useCopyDiagnostics();
  const setSearch = (patch: Partial<LogSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const entries = logs.data?.entries ?? [];
  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="grid flex-1 gap-1">
          <h2 className="font-serif text-xl">Logs</h2>
          <p className="text-fg-muted">
            What the app and Core did, newest first. Secrets are removed before anything is written.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void openLogFolder()}>
          <FolderOpen aria-hidden /> Open folder
        </Button>
        <Button variant="secondary" disabled={copy.isPending} onClick={() => copy.mutate()}>
          <ClipboardCopy aria-hidden /> Copy diagnostics
        </Button>
      </header>

      <LogFilters
        search={search}
        modules={logs.data?.modules ?? []}
        text={text}
        live={live}
        refreshing={logs.isFetching}
        onSearch={setSearch}
        onText={setText}
        onLive={setLive}
        onRefresh={() => void logs.refetch()}
      />

      <div className="rounded-card border border-border bg-surface shadow-1">
        {logs.error ? (
          <p className="p-4 text-danger-ink" role="alert">
            {logs.error.message}
          </p>
        ) : entries.length > 0 ? (
          <ul className="divide-y divide-border text-sm" aria-label="Log lines">
            {withKeys(entries).map(({ key, entry }) => (
              <LogRow key={key} entry={entry} onFilter={setSearch} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ScrollText}
            title={logs.isPending ? "Reading logs…" : "No matching log lines"}
            description="Lower the level or clear a filter to see more."
            className="py-10"
          />
        )}
      </div>
      {logs.data && <p className="text-xs text-fg-subtle">Files in {logs.data.dir}</p>}
    </section>
  );
}
