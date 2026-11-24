import {
  AppError,
  type LlmCallInput,
  type LlmCallResult,
  type LlmCompareInput,
  type LlmEvent,
  llmCallResultSchema,
  llmCompareResultSchema,
  llmStreamLineSchema,
  modelEntrySchema,
  modelSyncResultSchema,
  providerStatusSchema,
  type SetModelEnabledInput,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { ndjsonLines } from "./ndjson";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

/** Providers, models, and calls (`/llm`). */
export function createLlmClient(api: Api) {
  return {
    providers: async (refresh = false) =>
      parseResponse(
        await api.llm.providers.$get({ query: { refresh: refresh ? "1" : "0" } }),
        z.array(providerStatusSchema),
      ),
    models: async () => parseResponse(await api.llm.models.$get(), z.array(modelEntrySchema)),
    setModelEnabled: async (json: SetModelEnabledInput) =>
      parseResponse(await api.llm.models.$put({ json }), modelEntrySchema),
    syncOpenRouter: async () =>
      parseResponse(await api.llm.models.sync.$post(), modelSyncResultSchema),
    call: async (json: LlmCallInput, signal?: AbortSignal) =>
      parseResponse(await api.llm.call.$post({ json }, { init: { signal } }), llmCallResultSchema),
    compare: async (json: LlmCompareInput, signal?: AbortSignal) =>
      parseResponse(
        await api.llm.compare.$post({ json }, { init: { signal } }),
        llmCompareResultSchema,
      ),
    /** Streams one call; each line is Zod-parsed. Aborting `signal` cancels it in Core. */
    stream: async (
      json: LlmCallInput,
      onEvent: (event: LlmEvent) => void,
      signal?: AbortSignal,
    ): Promise<LlmCallResult> => {
      const res = await api.llm.stream.$post({ json }, { init: { signal } });
      if (!res.ok || !res.body) return parseResponse(res, llmCallResultSchema);
      for await (const line of ndjsonLines(res.body)) {
        const parsed = llmStreamLineSchema.parse(JSON.parse(line));
        if (parsed.kind === "result") return parsed.result;
        onEvent(parsed.event);
      }
      throw new AppError("unavailable", "The stream ended without a result");
    },
  };
}
