import type { AgentRunReport, ModelRef } from "@agentic/contracts";
import { addUsage, type CallOutcome } from "@agentic/llm";

export const emptyReport = (model: ModelRef): AgentRunReport => ({
  model,
  costUsd: null,
  durationMs: 0,
  attempts: 0,
});

/** Adds one call to a turn's report: tool rounds are several calls. */
export function addCall(report: AgentRunReport, outcome: CallOutcome): AgentRunReport {
  return {
    ...report,
    usage: addUsage(report.usage, outcome.usage),
    costUsd:
      report.costUsd === null && outcome.costUsd === null
        ? null
        : (report.costUsd ?? 0) + (outcome.costUsd ?? 0),
    durationMs: report.durationMs + outcome.durationMs,
    attempts: report.attempts + 1,
  };
}
