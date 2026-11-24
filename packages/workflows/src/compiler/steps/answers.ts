import { type GateAnswer, gateAnswerSchema, hasFields, type JsonSchema } from "@agentic/contracts";
import { checkJsonSchema } from "@agentic/llm";
import { isRecord } from "./context";

export const MAX_ASKS = 3;

export type CheckedAnswer =
  | { ok: true; answer: GateAnswer; data: Record<string, unknown> }
  | { ok: false; issues: string[] };

/**
 * Parses a gate or review answer. An approval's data (the shown data when
 * none is sent) must match the schema; a rejection needs no data.
 */
export function checkAnswer(
  raw: unknown,
  shown: Record<string, unknown>,
  schema: JsonSchema,
): CheckedAnswer {
  const parsed = gateAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: ["Approve or reject"] };
  const answer = parsed.data;
  const data = answer.data ?? shown;
  if (answer.action === "reject" || !hasFields(schema)) return { ok: true, answer, data };
  const checked = checkJsonSchema(schema, data);
  if (!checked.ok) return { ok: false, issues: checked.issues };
  return isRecord(checked.value)
    ? { ok: true, answer, data: checked.value }
    : { ok: false, issues: ["The data must be an object"] };
}
