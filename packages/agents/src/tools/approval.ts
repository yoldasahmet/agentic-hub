import {
  AppError,
  type ApprovalPolicy,
  type ToolApprovalRequest,
  type ToolDescriptor,
  toolApprovalAnswerSchema,
} from "@agentic/contracts";
import { decide } from "@agentic/tools";
import { interrupt } from "@langchain/langgraph";

const brief = (t: ToolDescriptor) => ({
  name: t.name,
  permission: t.permission,
  description: t.description || t.title,
});

/**
 * The tools an `llm` agent may use this run. `allow` tools are granted,
 * `deny` tools dropped, and `ask` tools are put to a person once, before
 * the first model call, so resuming never repeats a model or tool call.
 * Declining keeps the run going without them.
 */
export function grantTools(
  tools: readonly ToolDescriptor[],
  policy: ApprovalPolicy,
  workingDir: string,
): ToolDescriptor[] {
  const granted = tools.filter((t) => decide(policy, t.permission) === "allow");
  const ask = tools.filter((t) => decide(policy, t.permission) === "ask");
  if (ask.length === 0) return granted;
  const request: ToolApprovalRequest = {
    kind: "tool.approval",
    scope: "run",
    tools: ask.map(brief),
    workingDir,
  };
  const answer = toolApprovalAnswerSchema.safeParse(interrupt(request));
  return answer.success && answer.data.approved ? [...granted, ...ask] : granted;
}

/** One call of a `tool` agent, with its input, approved or refused by the policy or a person. */
export function approveCall(
  tool: ToolDescriptor,
  input: Record<string, unknown>,
  policy: ApprovalPolicy,
  workingDir: string,
): void {
  const decision = decide(policy, tool.permission);
  if (decision === "allow") return;
  if (decision === "deny") {
    throw new AppError("tool.denied", `The agent's policy denies ${tool.permission} tools`);
  }
  const request: ToolApprovalRequest = {
    kind: "tool.approval",
    scope: "call",
    tools: [brief(tool)],
    input,
    workingDir,
  };
  const answer = toolApprovalAnswerSchema.safeParse(interrupt(request));
  if (!answer.success || !answer.data.approved) {
    const note = answer.success ? answer.data.note : undefined;
    throw new AppError("tool.rejected", note ? `Rejected: ${note}` : `${tool.name} was rejected`);
  }
}
