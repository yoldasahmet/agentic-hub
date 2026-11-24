import { Button } from "@agentic/ui";
import { RefreshCw } from "lucide-react";
import { showError } from "../../lib/show-error";
import { OpenRouterKey } from "../settings/providers/openrouter-key";
import { ProviderRow } from "../settings/providers/provider-row";
import { useProviders, useRefreshProviders } from "../settings/providers/queries";
import { SetupStep, type StepState } from "./setup-step";

/** Model access: the CLIs found on this Mac, and an optional OpenRouter key. */
export function ProvidersStep() {
  const providers = useProviders();
  const refresh = useRefreshProviders();
  const ready = providers.data?.some((p) => p.installed && p.signedIn === true) ?? false;
  const state: StepState = ready ? "done" : providers.isPending ? "checking" : "todo";
  const redetect = () => refresh.mutate(undefined, { onError: (err) => showError(err) });
  return (
    <SetupStep
      number={2}
      title="Models"
      state={state}
      description="Agents call models through the Claude Code, Codex, Gemini, or OpenCode CLIs (install one and sign in with its own account), or through OpenRouter with an API key."
    >
      {providers.data && (
        <ul className="divide-y divide-border rounded-card border border-border">
          {providers.data.map((p) => (
            <ProviderRow key={p.id} provider={p} />
          ))}
        </ul>
      )}
      <div>
        <Button size="sm" variant="ghost" onClick={redetect} disabled={refresh.isPending}>
          <RefreshCw aria-hidden className={refresh.isPending ? "animate-spin" : undefined} />
          Detect again
        </Button>
      </div>
      <OpenRouterKey />
    </SetupStep>
  );
}
