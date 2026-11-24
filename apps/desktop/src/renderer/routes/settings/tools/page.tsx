import { AlertTriangle } from "lucide-react";
import { GuardrailsForm } from "./guardrails-form";
import { useGuardrails, useToolCatalog } from "./queries";
import { ToolList } from "./tool-list";

export function ToolsPage() {
  const guardrails = useGuardrails();
  const catalog = useToolCatalog();
  const failing = catalog.data?.servers.filter((s) => !s.ok) ?? [];
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Tools</h2>
        <p className="text-fg-muted">
          What agents can do besides talking. Each agent picks its tools and decides, per permission
          level, whether a call runs, waits for your approval, or is refused.
        </p>
      </header>
      <div className="rounded-card border border-border bg-surface p-4 shadow-1">
        <h3 className="pb-3 font-medium">Guardrails</h3>
        {guardrails.data && (
          <GuardrailsForm key={JSON.stringify(guardrails.data)} initial={guardrails.data} />
        )}
      </div>
      {failing.map((server) => (
        <p
          key={server.name}
          className="flex gap-2 rounded-card bg-warning-tint p-3 text-warning-ink"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          MCP server {server.name} could not be reached: {server.error}
        </p>
      ))}
      {catalog.data && <ToolList tools={catalog.data.tools} />}
    </section>
  );
}
