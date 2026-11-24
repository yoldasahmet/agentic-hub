import type { Agent } from "@agentic/contracts";
import { Badge, EntityAvatar } from "@agentic/ui";
import { Link } from "@tanstack/react-router";

const kindLabel = { llm: "LLM", tool: "Tool", human: "Human" } as const;

/** An agent in the list: identity, kind, model, and its published version. */
export function AgentCard({ agent }: { agent: Agent }) {
  const model = agent.draft.runtime.model;
  return (
    <Link
      to="/agents/$agentId"
      params={{ agentId: agent.id }}
      data-hue={agent.color}
      className="grid h-full gap-2 rounded-card border border-border bg-surface p-4 shadow-1 hover:border-border-input"
    >
      <div className="flex items-center gap-2">
        <EntityAvatar color={agent.color} icon={agent.icon} />
        <span className="flex-1 truncate font-medium">{agent.name}</span>
        <Badge>{agent.latestVersion ? `v${agent.latestVersion}` : "Draft"}</Badge>
      </div>
      <p className="line-clamp-2 text-fg-muted">{agent.description || "No description yet."}</p>
      <p className="text-sm text-fg-subtle">
        {kindLabel[agent.kind]}
        {agent.kind === "llm" && model ? ` · ${model.providerId} · ${model.model}` : ""}
      </p>
    </Link>
  );
}
