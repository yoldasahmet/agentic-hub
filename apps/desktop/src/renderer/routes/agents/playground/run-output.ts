import {
  type AgentRunReport,
  agentRunReportSchema,
  type HumanAgentRequest,
  humanAgentRequestSchema,
  type ThreadState,
} from "@agentic/contracts";
import { z } from "zod";

const outputSchema = z.record(z.string(), z.unknown());

/**
 * Reads an agent run from its thread's latest checkpoint (the source of
 * truth), so an edited output shows as soon as it is saved.
 */
export function readAgentState(state: ThreadState | undefined): {
  output?: Record<string, unknown>;
  report?: AgentRunReport;
  gate?: HumanAgentRequest;
} {
  const checkpoint = state?.state;
  if (!checkpoint) return {};
  const output = outputSchema.safeParse(checkpoint.values.output);
  const report = agentRunReportSchema.safeParse(checkpoint.values.report);
  const gate = humanAgentRequestSchema.safeParse(checkpoint.interrupts[0]?.value);
  return {
    output: output.success ? output.data : undefined,
    report: report.success ? report.data : undefined,
    gate: gate.success ? gate.data : undefined,
  };
}
