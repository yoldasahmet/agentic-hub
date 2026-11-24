import {
  AppError,
  hasFields,
  type JsonSchema,
  type WorkflowNode,
  type WorkflowReviewRequest,
} from "@agentic/contracts";
import { interrupt } from "@langchain/langgraph";
import { projectInput } from "../../bindings";
import { mapOutput } from "../output";
import type { WorkflowUpdate, WorkflowValues } from "../state";
import { checkAnswer, MAX_ASKS } from "./answers";
import { type StepContext, scopeOf } from "./context";
import { jsonRecord } from "./json";

type Stage = WorkflowReviewRequest["stage"];

/**
 * A review step the compiler adds before (`<id>__input`) or after
 * (`<id>__output`) a node. It is its own graph node, so resuming it never
 * re-runs the agent. Approving with edits overrides the node's input, or
 * replaces its output; rejecting stops the run.
 */
export function reviewStep(ctx: StepContext, node: WorkflowNode, stage: Stage, schema: JsonSchema) {
  const label = node.label || node.id;
  return async (state: WorkflowValues): Promise<WorkflowUpdate> => {
    const shown = jsonRecord(
      stage === "input"
        ? projectInput(node.bindings, scopeOf(state))
        : (state.nodes[node.id]?.output ?? {}),
    );
    let issues: string[] = [];
    for (let ask = 1; ask <= MAX_ASKS; ask++) {
      const request: WorkflowReviewRequest = {
        kind: "workflow.review",
        node: node.id,
        stage,
        label,
        schema,
        data: shown,
        issues,
      };
      const checked = checkAnswer(interrupt(request), shown, hasFields(schema) ? schema : {});
      if (!checked.ok) {
        issues = checked.issues;
        continue;
      }
      if (checked.answer.action === "reject") {
        throw new AppError("workflow.rejected", `${label}: ${stage} rejected`, {
          node: node.id,
          comment: checked.answer.comment ?? "",
        });
      }
      return stage === "input"
        ? { overrides: { [node.id]: checked.data } }
        : withOutput(ctx, state, node.id, checked.data);
    }
    throw new AppError("validation_failed", "The review answer did not match the fields", {
      issues,
    });
  };
}

function withOutput(
  ctx: StepContext,
  state: WorkflowValues,
  id: string,
  output: Record<string, unknown>,
): WorkflowUpdate {
  const current = state.nodes[id];
  if (!current) throw new AppError("internal", `"${id}" has no output to review`);
  const slot = { ...current, output };
  return { nodes: { [id]: slot }, output: mapOutput(ctx.doc, ctx.topo, state, id, slot) };
}
