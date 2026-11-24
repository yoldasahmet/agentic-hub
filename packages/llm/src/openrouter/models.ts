import type { ModelInfo } from "@agentic/contracts";
import { z } from "zod";

/** Prices are USD per token as decimal strings. */
const price = z.coerce.number().nonnegative().catch(0);

const modelsResponse = z.object({
  data: z.array(
    z.looseObject({
      id: z.string().min(1),
      name: z.string().optional(),
      context_length: z.number().int().positive().nullish(),
      pricing: z
        .looseObject({ prompt: price, completion: price, input_cache_read: price.optional() })
        .optional(),
      supported_parameters: z.array(z.string()).catch([]),
    }),
  ),
});

const perMTok = (perToken: number) => Math.round(perToken * 1e6 * 1e6) / 1e6;

/** `GET /api/v1/models` → catalog entries. Public: it needs no API key. */
export async function fetchOpenRouterModels(
  baseUrl: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  const res = await fetchImpl(`${baseUrl}/models`, { signal });
  if (!res.ok) throw new Error(`OpenRouter models request failed (${res.status})`);
  const { data } = modelsResponse.parse(await res.json());
  return data.map((m) => ({
    providerId: "openrouter",
    modelId: m.id,
    label: m.name ?? m.id,
    contextWindow: m.context_length ?? undefined,
    supportsReasoning: m.supported_parameters.includes("reasoning"),
    pricing: m.pricing
      ? {
          inputPerMTok: perMTok(m.pricing.prompt),
          outputPerMTok: perMTok(m.pricing.completion),
          cacheReadPerMTok:
            m.pricing.input_cache_read === undefined
              ? undefined
              : perMTok(m.pricing.input_cache_read),
        }
      : undefined,
  }));
}
