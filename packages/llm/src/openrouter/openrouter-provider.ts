import { redact } from "@agentic/cli-bridge";
import { DEFAULT_LLM_TIMEOUT_MS, type LlmEvent, type LlmRequest } from "@agentic/contracts";
import { z } from "zod";
import type { ModelCatalog } from "../catalog/catalog";
import type { LlmProvider } from "../provider";
import { ChunkMapper, chunkSchema } from "./chunk-mapper";
import { fetchOpenRouterModels } from "./models";
import { chatCompletionBody } from "./request-body";
import { sseData } from "./sse";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type OpenRouterDeps = {
  catalog: ModelCatalog;
  /** Read per call, so a key saved in Settings applies without a restart. */
  getApiKey: () => string | undefined;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type OpenRouterProvider = LlmProvider & {
  fetchModels(signal?: AbortSignal): ReturnType<typeof fetchOpenRouterModels>;
};

const errorBody = z.looseObject({ error: z.looseObject({ message: z.string() }) });

export function createOpenRouterProvider(deps: OpenRouterDeps): OpenRouterProvider {
  const baseUrl = deps.baseUrl ?? OPENROUTER_BASE_URL;
  const fetchImpl = deps.fetch ?? fetch;
  return {
    id: "openrouter",
    name: "OpenRouter",
    transport: "api",
    capabilities: {
      streaming: true,
      tools: true,
      structuredOutput: "native",
      reasoning: true,
      images: false,
      mcp: false,
    },
    async detect() {
      const hasKey = Boolean(deps.getApiKey());
      return {
        id: "openrouter",
        name: "OpenRouter",
        transport: "api",
        capabilities: this.capabilities,
        installed: true,
        signedIn: hasKey,
        detail: hasKey ? "API key in the vault" : "Add an OpenRouter API key",
      };
    },
    listModels: async () => deps.catalog.models("openrouter"),
    fetchModels: (signal) => fetchOpenRouterModels(baseUrl, fetchImpl, signal),
    stream: (req, signal) => streamChat(req, signal, { ...deps, baseUrl, fetch: fetchImpl }),
  };
}

async function* streamChat(
  req: LlmRequest,
  signal: AbortSignal | undefined,
  deps: Required<Pick<OpenRouterDeps, "baseUrl" | "fetch" | "getApiKey">>,
): AsyncGenerator<LlmEvent> {
  const key = deps.getApiKey();
  if (!key) {
    yield {
      type: "error",
      code: "openrouter.no_key",
      message: "Add an OpenRouter API key in Settings → Providers",
    };
    yield { type: "done", stopReason: "error" };
    return;
  }
  const signals = [signal, AbortSignal.timeout(req.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS)];
  const combined = AbortSignal.any(signals.filter((s): s is AbortSignal => s !== undefined));
  const mapper = new ChunkMapper();
  try {
    const res = await deps.fetch(`${deps.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "x-title": "Agentic Hub",
      },
      body: JSON.stringify(chatCompletionBody(req)),
      signal: combined,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      const parsed = errorBody.safeParse(safeJson(text));
      const message = parsed.success ? parsed.data.error.message : text.slice(0, 500);
      yield {
        type: "error",
        code: `openrouter.http_${res.status}`,
        message: redact(message, [key]),
      };
      yield { type: "done", stopReason: "error" };
      return;
    }
    for await (const data of sseData(res.body)) {
      if (data === "[DONE]") break;
      const chunk = chunkSchema.safeParse(safeJson(data));
      if (chunk.success) yield* mapper.map(chunk.data);
    }
    yield* mapper.flushCalls();
    yield { type: "done", stopReason: mapper.stopReason };
  } catch (err) {
    const aborted = combined.aborted;
    const timedOut = aborted && !signal?.aborted;
    yield {
      type: "error",
      code: timedOut
        ? "openrouter.timeout"
        : aborted
          ? "openrouter.cancelled"
          : "openrouter.network",
      message: timedOut
        ? "OpenRouter timed out"
        : aborted
          ? "Cancelled"
          : redact(String(err), [key]),
    };
    yield { type: "done", stopReason: aborted ? "cancelled" : "error" };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
