import type { LlmUsage, ModelPricing } from "@agentic/contracts";

/**
 * USD for one call. The provider's own figure wins (Claude Code and
 * OpenRouter report it); otherwise the catalog price is applied. Null means
 * unknown, e.g. a subscription CLI with no listed price.
 */
export function priceUsage(usage: LlmUsage | undefined, pricing?: ModelPricing): number | null {
  if (!usage) return null;
  if (usage.costUsd !== undefined) return usage.costUsd;
  if (!pricing) return null;
  const micros =
    usage.inputTokens * pricing.inputPerMTok +
    usage.outputTokens * pricing.outputPerMTok +
    (usage.cacheReadTokens ?? 0) * (pricing.cacheReadPerMTok ?? pricing.inputPerMTok) +
    (usage.cacheWriteTokens ?? 0) * (pricing.cacheWritePerMTok ?? pricing.inputPerMTok);
  return micros / 1e6;
}

/** Adds up usage across attempts (structured-output retries). */
export function addUsage(a: LlmUsage | undefined, b: LlmUsage | undefined): LlmUsage | undefined {
  if (!a || !b) return a ?? b;
  const sum = (x?: number, y?: number) =>
    x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: sum(a.cacheReadTokens, b.cacheReadTokens),
    cacheWriteTokens: sum(a.cacheWriteTokens, b.cacheWriteTokens),
    reasoningTokens: sum(a.reasoningTokens, b.reasoningTokens),
    costUsd: sum(a.costUsd, b.costUsd),
  };
}
