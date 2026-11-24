import { type CliSpec, detectCli, streamCli } from "@agentic/cli-bridge";
import type { ModelCatalog } from "../catalog/catalog";
import type { LlmProvider } from "../provider";

/**
 * Wraps a cli-bridge spec as an `LlmProvider`. Everything CLI-specific
 * (flags, parser, auth check) stays in the spec; this adds the catalog.
 */
export function createCliProvider(spec: CliSpec, catalog: ModelCatalog): LlmProvider {
  return {
    id: spec.id,
    name: spec.name,
    transport: "cli",
    capabilities: spec.capabilities,
    detect: () => detectCli(spec),
    listModels: async () => catalog.models(spec.id),
    stream: (req, signal, extras) => streamCli(spec, req, { signal, extras }),
  };
}
