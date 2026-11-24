import { AppError, type ProviderStatus } from "@agentic/contracts";
import type { LlmProvider } from "./provider";

const DETECT_TTL_MS = 30_000;

/**
 * The one list of providers. Detection spawns processes, so results are
 * cached briefly; Settings can force a refresh.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();
  private detected: { at: number; value: Promise<ProviderStatus[]> } | undefined;

  register(provider: LlmProvider): this {
    if (this.providers.has(provider.id)) {
      throw new AppError("conflict", `Provider ${provider.id} is already registered`);
    }
    this.providers.set(provider.id, provider);
    return this;
  }

  list(): LlmProvider[] {
    return [...this.providers.values()];
  }

  get(id: string): LlmProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new AppError("llm.provider_unknown", `Unknown provider: ${id}`);
    return provider;
  }

  detectAll({ refresh = false } = {}): Promise<ProviderStatus[]> {
    const now = Date.now();
    if (refresh || !this.detected || now - this.detected.at > DETECT_TTL_MS) {
      const value = Promise.all(this.list().map((p) => p.detect()));
      this.detected = { at: now, value };
      value.catch(() => {
        this.detected = undefined;
      });
    }
    return this.detected.value;
  }
}
