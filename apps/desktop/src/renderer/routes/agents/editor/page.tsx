import { EmptyState } from "@agentic/ui";
import { useParams } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useAgent } from "../queries";
import { AgentEditor } from "./agent-editor";

/** `/agents/$agentId`. Keyed by agent so switching agents resets the local draft. */
export function AgentEditorPage() {
  const { agentId } = useParams({ from: "/agents/$agentId" });
  const agent = useAgent(agentId);
  if (agent.error) {
    return <EmptyState icon={Bot} title="Agent not found" description={agent.error.message} />;
  }
  if (!agent.data) return null;
  return <AgentEditor key={agent.data.id} agent={agent.data} />;
}
