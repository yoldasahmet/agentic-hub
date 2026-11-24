import {
  type AppErrorShape,
  agentStreamEventSchema,
  type LlmEvent,
  type ModelRef,
  type RunEvent,
  type RunStatus,
} from "@agentic/contracts";

export type StreamItem =
  | { kind: "status"; status: RunStatus; error?: AppErrorShape }
  | { kind: "attempt"; model: ModelRef; attempt: number }
  | { kind: "text" | "thinking"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown; output?: unknown; isError?: boolean }
  | { kind: "error"; message: string }
  | { kind: "node"; node: string }
  | { kind: "gate" }
  | { kind: "custom"; data: unknown };

/**
 * Folds run events into display rows: consecutive text deltas become one
 * block, a tool result joins its call, and usage stays out (the summary
 * shows it). Pure, so a growing event list re-folds cheaply.
 */
export function foldEvents(events: RunEvent[]): StreamItem[] {
  const items: StreamItem[] = [];
  const push = (item: StreamItem) => {
    const last = items.at(-1);
    if ((item.kind === "text" || item.kind === "thinking") && last?.kind === item.kind) {
      last.text += item.text;
    } else {
      items.push(item);
    }
  };
  for (const event of events) {
    switch (event.type) {
      case "run.status":
        push({ kind: "status", status: event.payload.status, error: event.payload.error });
        break;
      case "node.updated":
        push({ kind: "node", node: event.payload.node });
        break;
      case "message.delta":
        push({ kind: "text", text: event.payload.content });
        break;
      case "run.interrupted":
        push({ kind: "gate" });
        break;
      case "custom": {
        const parsed = agentStreamEventSchema.safeParse(event.payload.data);
        if (!parsed.success) push({ kind: "custom", data: event.payload.data });
        else if (parsed.data.kind === "attempt") push({ ...parsed.data, kind: "attempt" });
        else if (parsed.data.kind === "tool") {
          const { name, status, summary } = parsed.data;
          push({
            kind: "tool",
            id: `${event.seq}`,
            name,
            input: undefined,
            output: summary,
            isError: status !== "ok",
          });
        } else foldLlm(parsed.data.event, items, push);
        break;
      }
    }
  }
  return items;
}

function foldLlm(event: LlmEvent, items: StreamItem[], push: (item: StreamItem) => void): void {
  switch (event.type) {
    case "text":
    case "thinking":
      push({ kind: event.type, text: event.delta });
      break;
    case "tool_call":
      push({ kind: "tool", id: event.id, name: event.name, input: event.input });
      break;
    case "tool_result": {
      const call = items.find((i) => i.kind === "tool" && i.id === event.id);
      if (call?.kind === "tool")
        Object.assign(call, { output: event.output, isError: event.isError });
      break;
    }
    case "error":
      push({ kind: "error", message: event.message });
      break;
  }
}
