import { Button, EmptyState } from "@agentic/ui";
import { Cpu, RefreshCw } from "lucide-react";
import { showError } from "../../../lib/show-error";
import { CompareModels } from "./compare-models";
import { ModelList } from "./model-list";
import { OpenRouterKey } from "./openrouter-key";
import { ProviderRow } from "./provider-row";
import { providerNames, useModels, useProviders, useRefreshProviders } from "./queries";
import { TestPrompt } from "./test-prompt";

export function ProvidersPage() {
  const providers = useProviders();
  const models = useModels();
  const refresh = useRefreshProviders();
  const names = providerNames(providers.data);

  const redetect = () => refresh.mutate(undefined, { onError: (err) => showError(err) });

  return (
    <section className="grid gap-8">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Providers</h2>
        <p className="text-fg-muted">
          Agents call models through the Claude Code, Codex, Gemini, and OpenCode CLIs (signed in
          with their own accounts) or through the OpenRouter API.
        </p>
      </header>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Detected</h3>
          <Button size="sm" variant="ghost" onClick={redetect} disabled={refresh.isPending}>
            <RefreshCw aria-hidden className={refresh.isPending ? "animate-spin" : undefined} />
            Detect again
          </Button>
        </div>
        {providers.data ? (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface shadow-1">
            {providers.data.map((p) => (
              <ProviderRow key={p.id} provider={p} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Cpu}
            title={providers.isError ? "Couldn't detect providers" : "Detecting providers…"}
            description={providers.error?.message ?? "Looking for installed CLIs."}
          />
        )}
        <OpenRouterKey />
      </div>

      {providers.data && models.data && (
        <>
          <div className="grid gap-3">
            <h3 className="font-medium">Models</h3>
            <ModelList models={models.data} providers={providers.data} />
          </div>
          <div className="grid gap-3">
            <h3 className="font-medium">Test</h3>
            <TestPrompt models={models.data} providerNames={names} />
          </div>
          <div className="grid gap-3">
            <h3 className="font-medium">Compare</h3>
            <CompareModels models={models.data} providerNames={names} />
          </div>
        </>
      )}
    </section>
  );
}
