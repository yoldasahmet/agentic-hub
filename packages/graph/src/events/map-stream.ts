import type { RunEventDraft } from "@agentic/contracts";
import { z } from "zod";

const chunkSchema = z.tuple([z.string(), z.unknown()]);
const messageTupleSchema = z.tuple([
  z.object({ content: z.unknown() }).loose(),
  z.object({ langgraph_node: z.string().optional() }).loose(),
]);

/**
 * Maps one `[mode, data]` chunk of `graph.stream(..., { streamMode: [...] })`
 * to run events. Interrupts are read from the final state instead, so they
 * are reported once with their node.
 */
export function mapStreamChunk(chunk: unknown): RunEventDraft[] {
  const parsed = chunkSchema.safeParse(chunk);
  if (!parsed.success) return [];
  const [mode, data] = parsed.data;
  if (mode === "updates") return mapUpdates(data);
  if (mode === "custom") return [{ type: "custom", payload: { data } }];
  if (mode === "messages") return mapMessage(data);
  return [];
}

function mapUpdates(data: unknown): RunEventDraft[] {
  if (data === null || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([node]) => !node.startsWith("__"))
    .map(([node, update]) => ({ type: "node.updated", payload: { node, update } }));
}

function mapMessage(data: unknown): RunEventDraft[] {
  const parsed = messageTupleSchema.safeParse(data);
  if (!parsed.success) return [];
  const [message, meta] = parsed.data;
  const content = textOf(message.content);
  if (!content) return [];
  return [{ type: "message.delta", payload: { node: meta.langgraph_node ?? null, content } }];
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
    .join("");
}
