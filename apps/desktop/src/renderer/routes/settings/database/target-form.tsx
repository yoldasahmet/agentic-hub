import {
  type DatabaseStatus,
  type DatabaseTargetInput,
  type DbMode,
  type DbTlsMode,
  dbConnectionStringSchema,
  dbModeSchema,
  dbTlsModeSchema,
} from "@agentic/contracts";
import { Button, Tabs, TabsList, TabsTrigger, toast } from "@agentic/ui";
import { type FormEvent, useState } from "react";
import { useSwitchDatabase, useTestDatabase } from "./queries";
import { RemoteFields } from "./remote-fields";

/** Picks Local or Remote, tests it, then switches (which reconnects and migrates). */
export function TargetForm({ status }: { status: DatabaseStatus }) {
  const [mode, setMode] = useState<DbMode>(status.settings.mode);
  const [tls, setTls] = useState<DbTlsMode>(status.settings.tls);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const test = useTestDatabase();
  const switchDb = useSwitchDatabase();
  const busy = test.isPending || switchDb.isPending;

  /** Validates the form. A blank URL reuses the saved one, if there is one. */
  const target = (): DatabaseTargetInput | undefined => {
    if (mode === "local" || (!url.trim() && status.remoteConfigured)) return { mode, tls };
    const parsed = dbConnectionStringSchema.safeParse(url);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return undefined;
    }
    return { mode, tls, connectionString: parsed.data };
  };

  const runTest = () => {
    const input = target();
    if (!input) return;
    setError(undefined);
    test.mutate(input, {
      onSuccess: (r) =>
        toast.success(`Connected to Postgres ${r.serverVersion} in ${r.latencyMs} ms`),
      onError: (err) => setError(err.message),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = target();
    if (!input) return;
    setError(undefined);
    switchDb.mutate(input, {
      onSuccess: (next) => {
        setUrl("");
        if (next.state === "ready") toast.success(`Using the ${next.settings.mode} database`);
        else setError(next.error);
      },
      onError: (err) => setError(err.message),
    });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-1"
    >
      <Tabs value={mode} onValueChange={(value) => setMode(dbModeSchema.parse(value))}>
        <TabsList aria-label="Database mode">
          <TabsTrigger value="local">Local</TabsTrigger>
          <TabsTrigger value="remote">Remote</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "local" ? (
        <p className="text-fg-muted">
          A Postgres service bundled with the app, stored in your app data folder. Nothing to set
          up, and no Docker.
        </p>
      ) : (
        <RemoteFields
          url={url}
          onUrlChange={setUrl}
          tls={tls}
          onTlsChange={(value) => setTls(dbTlsModeSchema.parse(value))}
          saved={status.remoteConfigured}
          invalid={Boolean(error)}
        />
      )}

      {error && <p className="text-sm text-danger-ink">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={runTest} disabled={busy}>
          Test connection
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          Switch and restart
        </Button>
      </div>
    </form>
  );
}
