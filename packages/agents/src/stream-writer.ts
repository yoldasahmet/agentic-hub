import type { AgentStreamEvent, LlmEvent, ToolCallEvent } from "@agentic/contracts";

type Writer = ((chunk: AgentStreamEvent) => void) | undefined;

const FLUSH_CHARS = 400;
const FLUSH_MS = 150;

/**
 * Forwards LLM events as `custom` run events. Every event is persisted, so
 * text and thinking deltas are merged into chunks of up to ~400 chars or
 * 150 ms instead of one row per token. Call `flush` when the call ends.
 */
export function agentEventWriter(writer: Writer) {
  let pending: Extract<LlmEvent, { type: "text" | "thinking" }> | undefined;
  let since = 0;

  const flush = () => {
    if (pending) writer?.({ kind: "llm", event: pending });
    pending = undefined;
  };

  return {
    flush,
    attempt(model: { providerId: string; model: string }, attempt: number) {
      flush();
      writer?.({ kind: "attempt", model, attempt });
    },
    tool(event: Omit<ToolCallEvent, "kind">) {
      flush();
      writer?.({ kind: "tool", ...event });
    },
    llm(event: LlmEvent) {
      if (event.type === "text" || event.type === "thinking") {
        if (pending && pending.type !== event.type) flush();
        if (!pending) {
          pending = { ...event };
          since = Date.now();
        } else {
          pending.delta += event.delta;
        }
        if (pending.delta.length >= FLUSH_CHARS || Date.now() - since >= FLUSH_MS) flush();
        return;
      }
      flush();
      writer?.({ kind: "llm", event });
    },
  };
}
