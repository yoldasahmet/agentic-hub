import type { CliExtras } from "@agentic/cli-bridge";
import type {
  AppErrorShape,
  LlmEvent,
  LlmRequest,
  LlmUsage,
  ModelPricing,
} from "@agentic/contracts";
import type { LlmProvider } from "../provider";
import { priceUsage } from "./cost";

export type CallOptions = {
  signal?: AbortSignal;
  pricing?: ModelPricing;
  /** Sees every event as it streams (UI, run events). */
  onEvent?: (event: LlmEvent) => void;
  extras?: CliExtras;
};

export type CallOutcome = {
  ok: boolean;
  text: string;
  structured?: unknown;
  toolCalls: Array<Extract<LlmEvent, { type: "tool_call" }>>;
  usage?: LlmUsage;
  costUsd: number | null;
  durationMs: number;
  error?: AppErrorShape;
};

/** Streams one request to the end and folds the events into a result. */
export async function callLlm(
  provider: LlmProvider,
  req: LlmRequest,
  { signal, pricing, onEvent, extras }: CallOptions = {},
): Promise<CallOutcome> {
  const started = Date.now();
  const out: CallOutcome = { ok: true, text: "", toolCalls: [], costUsd: null, durationMs: 0 };
  for await (const event of provider.stream(req, signal, extras)) {
    onEvent?.(event);
    switch (event.type) {
      case "text":
        out.text += event.delta;
        break;
      case "structured":
        out.structured = event.value;
        break;
      case "tool_call":
        out.toolCalls.push(event);
        break;
      case "usage":
        out.usage = event.usage;
        break;
      case "error":
        out.ok = false;
        out.error ??= { code: event.code || "llm.failed", message: event.message };
        break;
    }
  }
  out.durationMs = Date.now() - started;
  out.costUsd = priceUsage(out.usage, pricing);
  return out;
}
