import { AppError } from "@agentic/contracts";
import type { Toolset } from "@agentic/tools";
import type { agentEventWriter } from "../stream-writer";

export type ToolOutcome = { ok: true; value: unknown } | { ok: false; error: AppError };

const SUMMARY_CHARS = 300;

/**
 * Runs one tool and records it as a `tool` run event either way. Errors
 * come back as values, so the tool loop can show them to the model.
 */
export async function invokeTool(
  toolset: Toolset,
  name: string,
  input: Record<string, unknown>,
  cwd: string,
  signal: AbortSignal | undefined,
  events: ReturnType<typeof agentEventWriter>,
): Promise<ToolOutcome> {
  const started = Date.now();
  try {
    const value = await toolset.invoke(name, input, cwd, signal);
    events.tool({
      name,
      status: "ok",
      durationMs: Date.now() - started,
      summary: summarize(value),
    });
    return { ok: true, value };
  } catch (err) {
    const error = AppError.from(err);
    events.tool({
      name,
      status: error.code === "tool.dir_denied" ? "denied" : "error",
      durationMs: Date.now() - started,
      summary: error.message,
    });
    return { ok: false, error };
  }
}

function summarize(value: unknown): string {
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "");
  return text.length > SUMMARY_CHARS ? `${text.slice(0, SUMMARY_CHARS)}…` : text;
}
