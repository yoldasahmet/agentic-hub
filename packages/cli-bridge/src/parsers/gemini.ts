import type { LlmEvent } from "@agentic/contracts";
import { z } from "zod";
import { count, lineParser, type StreamParser } from "./stream-parser";

const line = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("message"),
    role: z.string(),
    content: z.string(),
    delta: z.boolean().optional(),
  }),
  z.looseObject({
    type: z.literal("tool_use"),
    tool_name: z.string(),
    tool_id: z.string(),
    parameters: z.unknown().optional(),
  }),
  z.looseObject({
    type: z.literal("tool_result"),
    tool_id: z.string(),
    status: z.string(),
    output: z.unknown().optional(),
    error: z.looseObject({ message: z.string() }).optional(),
  }),
  z.looseObject({
    type: z.literal("error"),
    severity: z.string().optional(),
    message: z.string(),
  }),
  z.looseObject({
    type: z.literal("result"),
    status: z.string(),
    error: z.looseObject({ message: z.string() }).optional(),
    stats: z.looseObject({ input_tokens: count, output_tokens: count, cached: count }).optional(),
  }),
]);

/**
 * `gemini -p … --output-format stream-json`. Assistant text arrives as
 * `message` events with `delta: true`; the final `result` carries status
 * and token stats. Warnings (`severity: "warning"`) are not errors.
 */
export function createGeminiParser(): StreamParser {
  return lineParser(line, (ev): LlmEvent[] => {
    switch (ev.type) {
      case "message":
        return ev.role === "assistant" && ev.content ? [{ type: "text", delta: ev.content }] : [];
      case "tool_use":
        return [
          { type: "tool_call", id: ev.tool_id, name: ev.tool_name, input: ev.parameters ?? {} },
        ];
      case "tool_result":
        return [
          {
            type: "tool_result",
            id: ev.tool_id,
            output: ev.error?.message ?? ev.output ?? null,
            isError: ev.status !== "success",
          },
        ];
      case "error":
        return ev.severity === "warning" ? [] : [{ type: "error", message: ev.message }];
      case "result": {
        const out: LlmEvent[] = [];
        if (ev.stats) {
          const { input_tokens, output_tokens, cached } = ev.stats;
          out.push({
            type: "usage",
            usage: {
              inputTokens: Math.max(0, input_tokens - cached),
              cacheReadTokens: cached,
              outputTokens: output_tokens,
            },
          });
        }
        if (ev.status !== "success") {
          out.push({
            type: "error",
            message: ev.error?.message ?? `Gemini finished with ${ev.status}`,
          });
        }
        out.push({ type: "done", stopReason: ev.status });
        return out;
      }
    }
  });
}
