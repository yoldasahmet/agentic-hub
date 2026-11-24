import type { LlmRequest, ToolDescriptor } from "@agentic/contracts";
import { type CallOptions, callLlm, callStructured, type LlmProvider } from "@agentic/llm";
import { type ParsedReply, parseToolReply } from "@agentic/tools";
import { z } from "zod";

const decision = z.object({ action: z.string(), payload: z.string() });
const input = z.record(z.string(), z.unknown());

export function readToolDecision(value: unknown): ParsedReply {
  const parsed = decision.safeParse(value);
  if (!parsed.success)
    return { kind: "invalid", before: "", issue: "Expected an action and payload" };
  const { action, payload } = parsed.data;
  if (action === "answer") return { kind: "answer", text: payload };
  try {
    return {
      kind: "call",
      before: "",
      call: { tool: action, input: input.parse(JSON.parse(payload)) },
    };
  } catch {
    return { kind: "invalid", before: "", issue: "Put the tool's JSON input object in payload" };
  }
}

/** A structured provider chooses an explicit next action. A progress message alone cannot end the loop. */
export async function toolRound(
  provider: LlmProvider,
  req: LlmRequest,
  options: CallOptions,
  tools: readonly ToolDescriptor[],
) {
  if (provider.capabilities.structuredOutput !== "native") {
    const call = await callLlm(provider, { ...req, outputSchema: undefined }, options);
    return { outcome: { ...call, attempts: 1 }, reply: parseToolReply(call.text) };
  }
  const outputSchema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["answer", ...tools.map((t) => t.name)],
        description: "Select the next tool to execute. Choose answer only when finished.",
      },
      payload: {
        type: "string",
        description:
          "The tool's input as a JSON object encoded in a string, or the completed answer.",
      },
    },
    required: ["action", "payload"],
    additionalProperties: false,
  };
  const outcome = await callStructured(provider, { ...req, outputSchema }, options);
  return { outcome, reply: readToolDecision(outcome.structured) };
}
