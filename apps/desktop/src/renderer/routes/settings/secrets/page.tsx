import { EmptyState } from "@agentic/ui";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useSecrets, useVaultStatus } from "./queries";
import { SecretForm } from "./secret-form";
import { SecretRow } from "./secret-row";

export function SecretsPage() {
  const status = useVaultStatus();
  const secrets = useSecrets();
  const unavailable = status.data && !status.data.available;

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Secrets</h2>
        <p className="text-fg-muted">
          API keys and tokens are encrypted in the {status.data?.backend ?? "system"} vault. Values
          are write-only: the app uses them, but never shows them again.
        </p>
      </header>

      {unavailable && (
        <div className="flex gap-2 rounded-card bg-danger-tint p-3 text-danger-ink" role="alert">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            Secure storage is not available ({status.data?.backend}). Secrets can't be saved until
            the system keychain is unlocked.
          </p>
        </div>
      )}

      <div className="rounded-card border border-border bg-surface shadow-1">
        {secrets.data && secrets.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {secrets.data.map((secret) => (
              <SecretRow key={secret.name} secret={secret} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={KeyRound}
            title="No secrets yet"
            description="Add an API key or token below. Providers and integrations refer to it by name."
            className="py-10"
          />
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-4 shadow-1">
        <h3 className="pb-3 font-medium">Add a secret</h3>
        <SecretForm />
      </div>
    </section>
  );
}
