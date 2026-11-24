import {
  agentStreamEventSchema,
  chatStreamEventSchema,
  type RunEvent,
  workflowStreamEventSchema,
} from "@agentic/contracts";
import type { LiveStatus } from "../workflow/types";

export type TurnView = {
  /** What the turn is doing now ("Running Poet"). */
  step?: string;
  /** Top-level workflow nodes in the order they started, with their latest status. */
  nodes: Array<{ node: string; status: LiveStatus }>;
  /** Agent stream events (a workflow's unwrapped), as the shared EventStream reads them. */
  stream: RunEvent[];
};

/** Folds a chat run's events into its live view: the step, node progress, and streamed output. */
export function turnView(events: RunEvent[]): TurnView {
  const view: TurnView = { nodes: [], stream: [] };
  const statuses = new Map<string, LiveStatus>();
  for (const event of events) {
    if (event.type !== "custom") continue;
    const data = event.payload.data;
    const step = chatStreamEventSchema.safeParse(data);
    if (step.success) {
      view.step = step.data.label;
      continue;
    }
    if (agentStreamEventSchema.safeParse(data).success) {
      view.stream.push(event);
      continue;
    }
    const workflow = workflowStreamEventSchema.safeParse(data);
    if (!workflow.success) continue;
    if (workflow.data.kind === "workflow.agent") {
      view.stream.push({ ...event, payload: { data: workflow.data.event } });
    } else if (workflow.data.ns === "") {
      statuses.set(workflow.data.node, workflow.data.status);
    }
  }
  view.nodes = [...statuses].map(([node, status]) => ({ node, status }));
  return view;
}
