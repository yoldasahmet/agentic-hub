import {
  type Interrupt,
  nodeOfStep,
  type Run,
  type RunEvent,
  type WorkflowState,
  workflowStreamEventSchema,
} from "@agentic/contracts";
import type { LiveStatus } from "@agentic/ui";
import { z } from "zod";

const failedNodeSchema = z.object({ node: z.string() });

/**
 * Each node's status in a run: what the state recorded, overlaid with the
 * live `workflow.node` events of this level (not a subworkflow's inner
 * nodes), then the gates waiting right now. A node's last event can be lost
 * when it throws, so a stopped run names its failed node in its error, and
 * nothing is shown running once the run has stopped.
 */
export function liveStatuses(
  run: Run,
  state: WorkflowState,
  events: RunEvent[],
  interrupts: Interrupt[],
): Record<string, LiveStatus> {
  const statuses: Record<string, LiveStatus> = {};
  for (const [id, slot] of Object.entries(state.nodes)) statuses[id] = slot.status;
  for (const event of events) {
    if (event.type !== "custom") continue;
    const parsed = workflowStreamEventSchema.safeParse(event.payload.data);
    if (parsed.success && parsed.data.kind === "workflow.node" && parsed.data.ns === "") {
      statuses[parsed.data.node] = parsed.data.status;
    }
  }
  for (const interrupt of interrupts) statuses[nodeOfStep(interrupt.node)] = "waiting";
  if (run.status === "failed" || run.status === "canceled" || run.status === "succeeded") {
    for (const [id, status] of Object.entries(statuses)) {
      if (status === "running" || status === "waiting") delete statuses[id];
    }
    const failed = failedNodeSchema.safeParse(run.error?.details);
    if (failed.success) {
      statuses[failed.data.node] = run.error?.code === "workflow.rejected" ? "rejected" : "failed";
    }
  }
  return statuses;
}

/**
 * One node's events, shaped like an agent run's (its LLM stream unwrapped),
 * so the shared EventStream shows them; `null` keeps every event.
 */
export function nodeEvents(events: RunEvent[], node: string | null): RunEvent[] {
  return events.flatMap((event): RunEvent[] => {
    if (event.type === "node.updated") {
      return node === null
        ? [{ ...event, payload: { ...event.payload, node: stepLabel(event.payload.node) } }]
        : [];
    }
    if (event.type !== "custom") return node === null || event.type === "run.status" ? [event] : [];
    const parsed = workflowStreamEventSchema.safeParse(event.payload.data);
    if (!parsed.success) return node === null ? [event] : [];
    if (node !== null && parsed.data.node !== node) return [];
    if (parsed.data.kind === "workflow.agent")
      return [{ ...event, payload: { data: parsed.data.event } }];
    return [];
  });
}

/** Review steps read as what they are: `draft__output` → "draft · output review". */
function stepLabel(step: string): string {
  const [node, stage] = step.split("__");
  return stage ? `${node} · ${stage} review` : step;
}
