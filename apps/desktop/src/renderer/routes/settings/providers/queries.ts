import { PROVIDER_SECRETS, type ProviderStatus } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../../lib/core-queries";
import { useSecrets } from "../secrets/queries";

export function useProviders() {
  return useCoreQuery(["llm", "providers"], (client) => client.llm.providers());
}

export function useModels() {
  return useCoreQuery(["llm", "models"], (client) => client.llm.models());
}

/** Detection is cached in Core; this forces a fresh look (after installing a CLI). */
export function useRefreshProviders() {
  return useCoreMutation((client) => client.llm.providers(true));
}

export function useSetModelEnabled() {
  return useCoreMutation(
    (client, input: { providerId: string; modelId: string; enabled: boolean }) =>
      client.llm.setModelEnabled(input),
  );
}

export function useSyncOpenRouter() {
  return useCoreMutation((client) => client.llm.syncOpenRouter());
}

export function useHasOpenRouterKey(): boolean {
  const { data } = useSecrets();
  return data?.some((s) => s.name === PROVIDER_SECRETS.openrouterApiKey) ?? false;
}

export function providerNames(providers: ProviderStatus[] | undefined): Record<string, string> {
  return Object.fromEntries((providers ?? []).map((p) => [p.id, p.name]));
}
