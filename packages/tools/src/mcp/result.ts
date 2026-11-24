import { AppError } from "@agentic/contracts";
import { z } from "zod";

const contentSchema = z.looseObject({ type: z.string(), text: z.string().optional() });
const resultSchema = z.looseObject({
  content: z.array(contentSchema).default([]),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  isError: z.boolean().optional(),
  toolResult: z.unknown().optional(),
});

/**
 * An MCP result as a plain value: structured content when the server gives
 * it, else the text parts joined; other parts are summarized by type. An
 * error result becomes a tool error with its text.
 */
export function readCallResult(tool: string, raw: unknown): unknown {
  const result = resultSchema.parse(raw);
  const text = result.content
    .map((part) => (part.type === "text" ? (part.text ?? "") : `[${part.type} content]`))
    .join("\n");
  if (result.isError) {
    throw new AppError("tool.failed", text || `MCP tool ${tool} failed`);
  }
  if (result.structuredContent) return result.structuredContent;
  if (result.toolResult !== undefined) return result.toolResult;
  return { text };
}
