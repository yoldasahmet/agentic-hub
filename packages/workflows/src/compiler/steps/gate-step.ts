import {
  AppError,
  type GateNode,
  renderTemplate,
  type WorkflowGateRequest,
} from "@agentic/contracts";
import { interrupt } from "@langchain/langgraph";
import { projectInput } from "../../bindings";
import { checkAnswer, MAX_ASKS } from "./answers";
import { type StepContext, scopeOf } from "./context";
import { jsonRecord } from "./json";
import { nodeStep } from "./node-step";

/**
 * A human gate: shows its bound data and message, and waits. Approve
 * (optionally with edited data) continues; reject stops the run or, with
 * `onReject: continue`, records `approved: false` for conditions to route on.
 */
export function gateStep(ctx: StepContext, node: GateNode) {
  return nodeStep(ctx, node, async (state) => {
    const data = jsonRecord(projectInput(node.bindings, scopeOf(state)));
    let issues: string[] = [];
    for (let ask = 1; ask <= MAX_ASKS; ask++) {
      const request: WorkflowGateRequest = {
        kind: "workflow.gate",
        node: node.id,
        title: node.title,
        message: renderTemplate(node.message, data).trim(),
        schema: node.schema,
        data,
        issues,
      };
      const checked = checkAnswer(interrupt(request), data, node.schema);
      if (!checked.ok) {
        issues = checked.issues;
        continue;
      }
      const { answer } = checked;
      const comment = answer.comment ?? "";
      if (answer.action === "approve") {
        return { output: { ...checked.data, approved: true, comment } };
      }
      if (node.onReject === "stop") {
        throw new AppError("workflow.rejected", `${node.title}: rejected`, { comment });
      }
      return { output: { ...data, approved: false, comment }, status: "rejected" };
    }
    throw new AppError("validation_failed", "The gate's answer did not match its fields", {
      issues,
    });
  });
}
