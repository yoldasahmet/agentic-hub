import type { LlmEvent, LlmUsage } from "@agentic/contracts";
import { z } from "zod";
import { count, lineParser, type StreamParser } from "./stream-parser";

const toolState = z.looseObject({
  status: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

const line = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("text"), part: z.looseObject({ text: z.string() }) }),
  z.looseObject({ type: z.literal("reasoning"), part: z.looseObject({ text: z.string() }) }),
  z.looseObject({
    type: z.literal("tool_use"),
    part: z.looseObject({ callID: z.string(), tool: z.string(), state: toolState }),
  }),
  z.looseObject({
    type: z.literal("step_finish"),
    part: z.looseObject({
      reason: z.string().optional(),
      cost: z.number().nonnegative().catch(0),
      tokens: z
        .looseObject({
          input: count,
          output: count,
          reasoning: count,
          cache: z.looseObject({ read: count, write: count }).catch({ read: 0, write: 0 }),
        })
        .optional(),
    }),
  }),
  z.looseObject({
    type: z.literal("error"),
    error: z.looseObject({
      name: z.string().optional(),
      data: z.looseObject({ message: z.string() }).partial().optional(),
    }),
  }),
]);

/**
 * `opencode run --format json`. Parts arrive whole when they finish, so a
 * text part is one `text` event. A run may take several steps (tool loops);
 * usage and cost are summed across `step_finish` events.
 */
export function createOpenCodeParser(): StreamParser {
  const total: Required<Omit<LlmUsage, "costUsd">> & { costUsd: number } = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
  };
  return lineParser(line, (ev): LlmEvent[] => {
    switch (ev.type) {
      case "text":
        return ev.part.text ? [{ type: "text", delta: ev.part.text }] : [];
      case "reasoning":
        return ev.part.text ? [{ type: "thinking", delta: ev.part.text }] : [];
      case "tool_use": {
        const { callID, tool, state } = ev.part;
        const call: LlmEvent = {
          type: "tool_call",
          id: callID,
          name: tool,
          input: state.input ?? {},
        };
        if (state.status !== "completed" && state.status !== "error") return [call];
        const isError = state.status === "error";
        return [
          call,
          {
            type: "tool_result",
            id: callID,
            output: isError ? state.error : state.output,
            isError,
          },
        ];
      }
      case "step_finish": {
        const t = ev.part.tokens;
        if (t) {
          total.inputTokens += t.input;
          total.outputTokens += t.output;
          total.reasoningTokens += t.reasoning;
          total.cacheReadTokens += t.cache.read;
          total.cacheWriteTokens += t.cache.write;
        }
        total.costUsd += ev.part.cost;
        const usage: LlmEvent = { type: "usage", usage: { ...total } };
        return ev.part.reason === "tool-calls"
          ? [usage]
          : [usage, { type: "done", stopReason: ev.part.reason }];
      }
      case "error":
        return [
          { type: "error", message: ev.error.data?.message ?? ev.error.name ?? "OpenCode error" },
        ];
    }
  });
}
