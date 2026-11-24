import type { CliExtras } from "@agentic/cli-bridge";
import type {
  LlmEvent,
  LlmRequest,
  LlmTransport,
  ModelInfo,
  ProviderCapabilities,
  ProviderStatus,
} from "@agentic/contracts";

/**
 * One interface for CLI and API providers (docs/architecture.md). `stream`
 * never throws for provider failures: they arrive as an `error` event,
 * and `done` is always the last event.
 */
export interface LlmProvider {
  readonly id: string;
  readonly name: string;
  readonly transport: LlmTransport;
  readonly capabilities: ProviderCapabilities;
  detect(): Promise<ProviderStatus>;
  /** The provider's catalog models. OpenRouter adds synced models in Core. */
  listModels(): Promise<ModelInfo[]>;
  /** `extras` (MCP servers for a CLI's own client) is ignored by providers without `mcp`. */
  stream(req: LlmRequest, signal?: AbortSignal, extras?: CliExtras): AsyncIterable<LlmEvent>;
}
