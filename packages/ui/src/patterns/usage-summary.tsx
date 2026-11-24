import type { LlmUsage } from "@agentic/contracts";
import { cn } from "../lib/cn";

const tokens = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());

/** USD with enough precision for sub-cent calls. */
export function formatCost(costUsd: number | null | undefined): string {
  if (costUsd === null || costUsd === undefined) return "cost unknown";
  if (costUsd === 0) return "$0";
  return costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`;
}

/** One line of call stats: tokens in/out (+ cache), cost, and time. */
export function UsageSummary({
  usage,
  costUsd,
  durationMs,
  className,
}: {
  usage?: LlmUsage;
  costUsd: number | null | undefined;
  durationMs?: number;
  className?: string;
}) {
  const parts = [
    usage && `${tokens(usage.inputTokens)} in`,
    usage?.cacheReadTokens ? `${tokens(usage.cacheReadTokens)} cached` : undefined,
    usage && `${tokens(usage.outputTokens)} out`,
    formatCost(costUsd),
    durationMs === undefined ? undefined : `${(durationMs / 1000).toFixed(1)}s`,
  ].filter(Boolean);
  return (
    <p data-selectable className={cn("font-mono text-code text-fg-muted", className)}>
      {parts.join(" · ")}
    </p>
  );
}
