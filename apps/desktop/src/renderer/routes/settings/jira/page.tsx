import { CircleCheck, CircleSlash } from "lucide-react";
import { useJiraStatus } from "../../jira/queries";
import { ConnectionForm } from "./connection-form";

/** Settings → Jira: the site, the account, and its API token. */
export function JiraSettingsPage() {
  const status = useJiraStatus().data;
  const connected = status?.user != null;
  const Icon = connected ? CircleCheck : CircleSlash;
  return (
    <section className="grid max-w-2xl gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Jira</h2>
        <p className="text-fg-muted">
          Browse projects and issues, give agents Jira tools, start workflows from JQL matches, and
          link pull requests back to the issues they name.
        </p>
      </header>
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
        <Icon
          className={connected ? "size-5 text-success-ink" : "size-5 text-fg-muted"}
          aria-hidden
        />
        <div className="grid flex-1 gap-0.5">
          <p className="font-medium">
            {connected ? `Signed in as ${status?.user?.displayName}` : "Not connected"}
          </p>
          <p className="text-sm text-fg-muted">
            {status?.siteUrl || "No site yet"}
            {status?.email ? ` · ${status.email}` : ""}
            {status && !status.hasToken ? " · no API token" : ""}
          </p>
          {status?.error && <p className="text-sm text-danger-ink">{status.error}</p>}
        </div>
      </div>
      <ConnectionForm hasToken={status?.hasToken ?? false} />
    </section>
  );
}
