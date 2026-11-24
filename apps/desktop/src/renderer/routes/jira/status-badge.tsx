import type { JiraStatus } from "@agentic/contracts";
import { Badge } from "@agentic/ui";

const tone = { new: "neutral", indeterminate: "info", done: "success" } as const;

/** A Jira status, colored by its category (to do, in progress, done). */
export function StatusBadge({ status }: { status: JiraStatus }) {
  return <Badge tone={tone[status.category]}>{status.name}</Badge>;
}
