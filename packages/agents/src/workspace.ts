import { AppError } from "@agentic/contracts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * The workspace a run belongs to. The run executor puts it in
 * `configurable`, and subgraphs (workflows, chat) inherit it, so MCP
 * servers, skills, and guardrails resolve in the run's own workspace.
 */
export function workspaceOf(config: LangGraphRunnableConfig): string {
  const id: unknown = config.configurable?.workspace_id;
  if (typeof id !== "string" || !id) {
    throw new AppError("internal", "The run has no workspace; tools can't be resolved");
  }
  return id;
}
