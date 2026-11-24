import type { JsonSchema, LlmRequest } from "@agentic/contracts";
import { type CallOptions, type CallOutcome, callLlm } from "../calls/call-llm";
import { addUsage } from "../calls/cost";
import type { LlmProvider } from "../provider";
import { extractJson } from "./extract-json";
import { checkJsonSchema } from "./json-schema";

export type StructuredOutcome = CallOutcome & { attempts: number };

const instruction = (schema: JsonSchema) =>
  [
    "Reply with only a JSON value that matches this JSON Schema. No prose, no code fences.",
    JSON.stringify(schema),
  ].join("\n");

/**
 * A call whose answer must match `req.outputSchema`. Providers with a
 * native schema option get the schema directly; others get it in the
 * prompt and the JSON is extracted from the text. Either way the value is
 * validated, and a failure is sent back for repair up to `retries` times.
 */
export async function callStructured(
  provider: LlmProvider,
  req: LlmRequest & { outputSchema: JsonSchema },
  { retries = 2, ...options }: CallOptions & { retries?: number } = {},
): Promise<StructuredOutcome> {
  const native = provider.capabilities.structuredOutput === "native";
  const extracting: LlmRequest = {
    ...req,
    outputSchema: undefined,
    system: [req.system, instruction(req.outputSchema)].filter(Boolean).join("\n\n"),
  };
  let current = native ? req : extracting;
  let total: StructuredOutcome | undefined;
  let attempts = 0;

  for (let repair = 0; repair <= retries; repair++) {
    let outcome = await callLlm(provider, current, options);
    total = merge(total, outcome, ++attempts);
    // Strict native formats can reject valid agent schemas, e.g. a free-form JSON field.
    if (current.outputSchema && outcome.error?.code === "llm.schema_rejected") {
      current = extracting;
      outcome = await callLlm(provider, current, options);
      total = merge(total, outcome, ++attempts);
    }
    if (!outcome.ok) return total;

    const candidate =
      outcome.structured !== undefined ? { value: outcome.structured } : extractJson(outcome.text);
    const check = candidate
      ? checkJsonSchema(req.outputSchema, candidate.value)
      : { ok: false as const, issues: ["The answer contained no JSON"] };
    if (check.ok) return { ...total, structured: check.value, error: undefined };

    total.error = {
      code: "llm.output_invalid",
      message: "The answer did not match the output schema",
      details: { issues: check.issues },
    };
    total.ok = false;
    current = {
      ...current,
      messages: [
        ...current.messages,
        { role: "assistant", content: outcome.text || JSON.stringify(outcome.structured) },
        {
          role: "user",
          content: `That did not match the schema:\n- ${check.issues.slice(0, 10).join("\n- ")}\nReply with only the corrected JSON.`,
        },
      ],
    };
  }
  return total ?? { ok: false, text: "", toolCalls: [], costUsd: null, durationMs: 0, attempts: 0 };
}

function merge(
  prev: StructuredOutcome | undefined,
  next: CallOutcome,
  attempts: number,
): StructuredOutcome {
  if (!prev) return { ...next, attempts };
  const costUsd =
    prev.costUsd === null && next.costUsd === null
      ? null
      : (prev.costUsd ?? 0) + (next.costUsd ?? 0);
  return {
    ...next,
    usage: addUsage(prev.usage, next.usage),
    costUsd,
    durationMs: prev.durationMs + next.durationMs,
    attempts,
  };
}
