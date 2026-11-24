import { z } from "zod";

/** The App's tool calls use the shared fenced-block protocol (packages/tools). */
export { type ParsedReply, parseToolReply as parseReply, type ToolCall } from "@agentic/tools";

/** `run`'s input: an agent or workflow by id, slug, or name, with the inputs the model gathered. */
export const runCallSchema = z.object({
  kind: z.enum(["agent", "workflow"]),
  target: z.string().min(1).max(200),
  inputs: z.record(z.string(), z.json()).default({}),
});
