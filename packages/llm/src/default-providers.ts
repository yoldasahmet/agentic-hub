import { cliSpecs } from "@agentic/cli-bridge";
import { ModelCatalog } from "./catalog/catalog";
import { createCliProvider } from "./cli/cli-provider";
import {
  createOpenRouterProvider,
  type OpenRouterProvider,
} from "./openrouter/openrouter-provider";
import { ProviderRegistry } from "./registry";

export type DefaultProviders = {
  registry: ProviderRegistry;
  catalog: ModelCatalog;
  openRouter: OpenRouterProvider;
};

/** The four CLIs plus OpenRouter, sharing one catalog. */
export function createDefaultProviders(options: {
  getOpenRouterKey: () => string | undefined;
  openRouterBaseUrl?: string;
  catalog?: ModelCatalog;
}): DefaultProviders {
  const catalog = options.catalog ?? new ModelCatalog();
  const registry = new ProviderRegistry();
  for (const spec of cliSpecs) registry.register(createCliProvider(spec, catalog));
  const openRouter = createOpenRouterProvider({
    catalog,
    getApiKey: options.getOpenRouterKey,
    baseUrl: options.openRouterBaseUrl,
  });
  registry.register(openRouter);
  return { registry, catalog, openRouter };
}
