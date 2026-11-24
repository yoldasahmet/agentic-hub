import { parseAgentAssistantId, parseWorkflowAssistantId } from "@agentic/contracts";
import { EntityChip } from "@agentic/ui";
import { useAgents } from "../agents/queries";
import { useWorkflows } from "../workflows/queries";

/** An assistant as people know it: an agent's or workflow's chip with "draft" or its version, else its id. */
export function AssistantLabel({ assistantId, version }: { assistantId: string; version: number }) {
  const agentRef = parseAgentAssistantId(assistantId);
  const workflowRef = parseWorkflowAssistantId(assistantId);
  const agent = useAgents().data?.find((a) => a.id === agentRef?.agentId);
  const workflow = useWorkflows().data?.find((w) => w.id === workflowRef?.workflowId);
  const entity = agent ?? workflow;
  const draft = agentRef?.draft ?? workflowRef?.draft ?? false;
  if (!entity) return <span className="truncate">{assistantId}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <EntityChip entity={entity} />
      <span className="text-sm font-normal text-fg-muted">{draft ? "draft" : `v${version}`}</span>
    </span>
  );
}
