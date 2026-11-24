import type { ModelEntry, ProviderStatus } from "@agentic/contracts";
import { Button, Input, Switch, toast } from "@agentic/ui";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useSetModelEnabled, useSyncOpenRouter } from "./queries";

const MAX_SYNCED_SHOWN = 40;

/** Turn models on or off per provider. Synced OpenRouter models are searched, not listed whole. */
export function ModelList({
  models,
  providers,
}: {
  models: ModelEntry[];
  providers: ProviderStatus[];
}) {
  const [filter, setFilter] = useState("");
  const setEnabled = useSetModelEnabled();
  const sync = useSyncOpenRouter();

  const toggle = (m: ModelEntry, enabled: boolean) =>
    setEnabled.mutate(
      { providerId: m.providerId, modelId: m.modelId, enabled },
      { onError: (err) => showError(err) },
    );
  const syncModels = () =>
    sync.mutate(undefined, {
      onSuccess: ({ synced }) => toast.success(`Synced ${synced} OpenRouter models`),
      onError: (err) => showError(err),
    });

  const needle = filter.trim().toLowerCase();
  const synced = models
    .filter((m) => m.source === "openrouter")
    .filter((m) => (needle ? `${m.modelId} ${m.label}`.toLowerCase().includes(needle) : m.enabled));

  return (
    <div className="grid gap-4">
      {providers.map((p) => (
        <ModelGroup key={p.id} title={p.name}>
          {models
            .filter((m) => m.providerId === p.id && m.source === "catalog")
            .map((m) => (
              <ModelRow key={m.modelId} model={m} onToggle={toggle} />
            ))}
          {p.id === "openrouter" && (
            <>
              <li className="flex gap-2 px-4 py-2">
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search synced models"
                  aria-label="Search synced OpenRouter models"
                />
                <Button size="md" onClick={syncModels} disabled={sync.isPending}>
                  <RefreshCw aria-hidden className={sync.isPending ? "animate-spin" : undefined} />
                  Sync models
                </Button>
              </li>
              {synced.slice(0, MAX_SYNCED_SHOWN).map((m) => (
                <ModelRow key={m.modelId} model={m} onToggle={toggle} />
              ))}
              {synced.length > MAX_SYNCED_SHOWN && (
                <li className="px-4 py-2 text-sm text-fg-muted">
                  {synced.length - MAX_SYNCED_SHOWN} more; refine the search.
                </li>
              )}
            </>
          )}
        </ModelGroup>
      ))}
    </div>
  );
}

function ModelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={`${title} models`}
      className="rounded-card border border-border bg-surface shadow-1"
    >
      <h3 className="border-b border-border px-4 py-2 font-medium">{title}</h3>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function ModelRow({
  model,
  onToggle,
}: {
  model: ModelEntry;
  onToggle: (m: ModelEntry, enabled: boolean) => void;
}) {
  const price = model.pricing
    ? `$${model.pricing.inputPerMTok} / $${model.pricing.outputPerMTok} per M`
    : undefined;
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate">{model.label}</p>
        <p className="truncate font-mono text-code text-fg-subtle">
          {[model.modelId, model.tier, price].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Switch
        checked={model.enabled}
        onCheckedChange={(on) => onToggle(model, on)}
        aria-label={`Enable ${model.label}`}
      />
    </li>
  );
}
