import { useDatabaseStatus } from "../../../shell/queries";
import { BackupCard } from "./backup-card";
import { StatusCard } from "./status-card";
import { TargetForm } from "./target-form";

export function DatabasePage() {
  const { data: status } = useDatabaseStatus();

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Database</h2>
        <p className="text-fg-muted">
          Agents, workflows, runs, and chats are stored in Postgres: the bundled local service by
          default, or a shared team database.
        </p>
      </header>
      {status && <StatusCard status={status} />}
      {/* Remounts after a switch so the form starts from the saved settings. */}
      {status && (
        <TargetForm key={`${status.settings.mode}-${status.settings.tls}`} status={status} />
      )}
      {status?.settings.mode === "local" && <BackupCard status={status} />}
    </section>
  );
}
