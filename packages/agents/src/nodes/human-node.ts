import {
  type AgentSpec,
  AppError,
  type HumanAgentRequest,
  hasFields,
  type JsonValue,
  renderTemplate,
} from "@agentic/contracts";
import { checkJsonSchema } from "@agentic/llm";
import { interrupt } from "@langchain/langgraph";
import type { AgentStateUpdate } from "../agent-state";

const MAX_ASKS = 3;

/**
 * The `human` kind: a gate that asks the rendered template and validates
 * the answer against the output schema, asking again with the issues when
 * it doesn't match. Each `interrupt` call is resumed in order.
 */
export function runHumanAgent(spec: AgentSpec, input: Record<string, JsonValue>): AgentStateUpdate {
  const question = renderTemplate(spec.prompt.template, input).trim() || "Provide the output";
  let issues: string[] = [];
  for (let ask = 1; ask <= MAX_ASKS; ask++) {
    const request: HumanAgentRequest = {
      kind: "agent.human",
      question,
      outputSchema: spec.outputSchema,
      input,
      issues,
    };
    const answer: unknown = interrupt(request);
    const checked = check(spec, answer);
    if (checked.ok) {
      return { output: checked.value, report: { costUsd: null, durationMs: 0, attempts: ask } };
    }
    issues = checked.issues;
  }
  throw new AppError("validation_failed", "The answer did not match the output schema", {
    issues,
  });
}

type Checked = { ok: true; value: Record<string, unknown> } | { ok: false; issues: string[] };

/** Free-text agents take a string (or `{ text }`); others take an object that matches. */
function check(spec: AgentSpec, answer: unknown): Checked {
  if (!hasFields(spec.outputSchema)) {
    if (typeof answer === "string" && answer.trim()) return { ok: true, value: { text: answer } };
    const text = isRecord(answer) ? answer.text : undefined;
    if (typeof text === "string" && text.trim()) return { ok: true, value: { text } };
    return { ok: false, issues: ["Write an answer"] };
  }
  const result = checkJsonSchema(spec.outputSchema, answer);
  if (!result.ok) return result;
  return isRecord(result.value)
    ? { ok: true, value: result.value }
    : { ok: false, issues: ["The answer must be an object"] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
