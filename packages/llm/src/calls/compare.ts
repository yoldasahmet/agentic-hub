import { AppError, type LlmRequest, type ModelPricing, type ModelRef } from "@agentic/contracts";
import type { ProviderRegistry } from "../registry";
import { callStructured } from "../structured/call-structured";
import { type CallOutcome, callLlm } from "./call-llm";

export type CompareOutcome = ModelRef & CallOutcome;

export type CompareOptions = {
  signal?: AbortSignal;
  pricingFor?: (ref: ModelRef) => ModelPricing | undefined;
};

/**
 * Multi-model fan-out: the same request to every target at once. One
 * target failing never fails the others; results keep the input order.
 */
export function compareModels(
  registry: ProviderRegistry,
  targets: ModelRef[],
  req: Omit<LlmRequest, "model">,
  { signal, pricingFor }: CompareOptions = {},
): Promise<CompareOutcome[]> {
  return Promise.all(
    targets.map(async (ref): Promise<CompareOutcome> => {
      try {
        const provider = registry.get(ref.providerId);
        const call = { ...req, model: ref.model };
        const options = { signal, pricing: pricingFor?.(ref) };
        const outcome = call.outputSchema
          ? await callStructured(provider, { ...call, outputSchema: call.outputSchema }, options)
          : await callLlm(provider, call, options);
        return { ...ref, ...outcome };
      } catch (err) {
        const error = AppError.from(err).toJSON();
        return { ...ref, ok: false, text: "", toolCalls: [], costUsd: null, durationMs: 0, error };
      }
    }),
  );
}
