import type { LlmEvent } from "@agentic/contracts";
import { z } from "zod";

/**
 * Turns one CLI's stdout lines into normalized `LlmEvent`s. Parsers are
 * stateful (they dedupe deltas against final messages) and never throw:
 * a line they don't understand is skipped, because CLIs add event types
 * between releases.
 */
export type StreamParser = {
  push(line: string): LlmEvent[];
};

const jsonObject = z.record(z.string(), z.unknown());

/** Parses a JSONL line into a plain object, or undefined for noise (banners, logs). */
export function parseJsonLine(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    const parsed = jsonObject.safeParse(JSON.parse(trimmed));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Builds a parser from a Zod union of the line shapes a CLI emits. */
export function lineParser<S extends z.ZodType>(
  schema: S,
  handle: (event: z.infer<S>) => LlmEvent[],
): StreamParser {
  return {
    push(line) {
      const raw = parseJsonLine(line);
      if (!raw) return [];
      const parsed = schema.safeParse(raw);
      return parsed.success ? handle(parsed.data) : [];
    },
  };
}

export const count = z.number().int().nonnegative().catch(0);
