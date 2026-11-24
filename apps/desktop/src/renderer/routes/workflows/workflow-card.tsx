import type { Workflow } from "@agentic/contracts";
import { Badge, EntityAvatar } from "@agentic/ui";
import { Link } from "@tanstack/react-router";

/** A workflow in the list: identity, node count, and its published version. */
export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const nodes = workflow.draft.nodes.length;
  return (
    <Link
      to="/workflows/$workflowId"
      params={{ workflowId: workflow.id }}
      className="grid h-full gap-2 rounded-card border border-border bg-surface p-4 shadow-1 hover:border-border-input"
    >
      <div className="flex items-center gap-2">
        <EntityAvatar color={workflow.color} icon={workflow.icon} />
        <span className="flex-1 truncate font-medium">{workflow.name}</span>
        <Badge>{workflow.latestVersion ? `v${workflow.latestVersion}` : "Draft"}</Badge>
      </div>
      <p className="line-clamp-2 text-fg-muted">{workflow.description || "No description yet."}</p>
      <p className="text-sm text-fg-subtle">
        {nodes} {nodes === 1 ? "node" : "nodes"} · {workflow.draft.edges.length} edges
      </p>
    </Link>
  );
}
