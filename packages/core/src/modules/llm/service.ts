import {
  AppError,
  type LlmCallInput,
  type LlmCallResult,
  type LlmCompareInput,
  type LlmEvent,
  type LlmRequest,
  type ModelEntry,
  type ModelRef,
  type ProviderStatus,
  type SetModelEnabledInput,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import {
  type CallOutcome,
  callLlm,
  callStructured,
  compareModels,
  type DefaultProviders,
} from "@agentic/llm";
import type { ModelRepository } from "./repository";

const CALL_TIMEOUT_MS = 5 * 60_000;
const key = (providerId: string, modelId: string) => `${providerId}\u0000${modelId}`;

/**
 * Providers, the workspace's model list, and one-off calls (Settings →
 * Providers "Test" and "Compare"). Agent runs call providers from their
 * graph nodes instead (P6.5).
 */
export class LlmService {
  constructor(
    private readonly providers: DefaultProviders,
    private readonly repo: ModelRepository,
    /** A neutral working dir so test prompts don't run in someone's project. */
    private readonly scratchDir: string,
  ) {}

  detect(refresh: boolean): Promise<ProviderStatus[]> {
    return this.providers.registry.detectAll({ refresh });
  }

  /** Catalog models (on unless turned off) plus synced OpenRouter models (off unless turned on). */
  async models(ctx: Pick<LocalContext, "workspaceId">): Promise<ModelEntry[]> {
    const stored = new Map(
      (await this.repo.list(ctx)).map((m) => [key(m.providerId, m.modelId), m]),
    );
    const out: ModelEntry[] = [];
    for (const provider of this.providers.registry.list()) {
      for (const model of this.providers.catalog.models(provider.id)) {
        const k = key(model.providerId, model.modelId);
        out.push({ ...model, source: "catalog", enabled: stored.get(k)?.enabled ?? true });
        stored.delete(k);
      }
    }
    for (const model of stored.values()) {
      if (model.source === "openrouter") out.push({ ...model, isDefault: false });
    }
    return out;
  }

  /**
   * The model a chat uses when it has none: the catalog default of a
   * provider that is ready, else any enabled model of a ready provider.
   */
  async defaultModel(workspaceId: string): Promise<ModelRef | undefined> {
    const statuses = await this.detect(false);
    const ready = new Set(
      statuses.filter((s) => s.installed && s.signedIn !== false).map((s) => s.id),
    );
    const usable = (await this.models({ workspaceId })).filter(
      (m) => m.enabled && ready.has(m.providerId),
    );
    const pick = usable.find((m) => m.isDefault) ?? usable[0];
    return pick ? { providerId: pick.providerId, model: pick.modelId } : undefined;
  }

  async setEnabled(ctx: LocalContext, input: SetModelEnabledInput): Promise<ModelEntry> {
    const model = (await this.models(ctx)).find(
      (m) => m.providerId === input.providerId && m.modelId === input.modelId,
    );
    if (!model)
      throw new AppError("not_found", `Unknown model ${input.providerId}/${input.modelId}`);
    const next = { ...model, enabled: input.enabled };
    await this.repo.setEnabled(ctx, next);
    return next;
  }

  async syncOpenRouter(ctx: LocalContext): Promise<{ synced: number }> {
    let synced: Awaited<ReturnType<DefaultProviders["openRouter"]["fetchModels"]>>;
    try {
      synced = await this.providers.openRouter.fetchModels(AbortSignal.timeout(30_000));
    } catch (err) {
      throw new AppError("unavailable", "Could not reach OpenRouter to sync models", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    await this.repo.upsertSynced(ctx, synced);
    return { synced: synced.length };
  }

  /** One prompt to one model; `onEvent` sees the stream as it happens. */
  async call(
    ctx: LocalContext,
    input: LlmCallInput,
    options: { signal?: AbortSignal; onEvent?: (event: LlmEvent) => void } = {},
  ): Promise<LlmCallResult> {
    const provider = this.providers.registry.get(input.providerId);
    const req = this.request(input, input.model);
    const call = { ...options, pricing: await this.pricing(ctx, input.providerId, input.model) };
    const outcome = req.outputSchema
      ? await callStructured(provider, { ...req, outputSchema: req.outputSchema }, call)
      : await callLlm(provider, req, call);
    return toResult(input.providerId, input.model, outcome);
  }

  async compare(
    ctx: LocalContext,
    input: LlmCompareInput,
    signal?: AbortSignal,
  ): Promise<LlmCallResult[]> {
    const prices = new Map(
      await Promise.all(
        input.targets.map(
          async (t) =>
            [key(t.providerId, t.model), await this.pricing(ctx, t.providerId, t.model)] as const,
        ),
      ),
    );
    const { model: _model, ...base } = this.request(input, "");
    const outcomes = await compareModels(this.providers.registry, input.targets, base, {
      signal,
      pricingFor: (ref) => prices.get(key(ref.providerId, ref.model)),
    });
    return outcomes.map((o) => toResult(o.providerId, o.model, o));
  }

  private request(input: Omit<LlmCallInput, "providerId" | "model">, model: string): LlmRequest {
    return {
      model,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
      outputSchema: input.outputSchema,
      reasoning: input.reasoning,
      cwd: this.scratchDir,
      timeoutMs: CALL_TIMEOUT_MS,
    };
  }

  private async pricing(ctx: LocalContext, providerId: string, modelId: string) {
    return (
      this.providers.catalog.find(providerId, modelId)?.pricing ??
      (await this.repo.pricing(ctx, providerId, modelId))
    );
  }
}

export function failedCall(input: LlmCallInput, err: unknown): LlmCallResult {
  return toResult(input.providerId, input.model, {
    ok: false,
    text: "",
    toolCalls: [],
    costUsd: null,
    durationMs: 0,
    error: AppError.from(err).toJSON(),
  });
}

function toResult(providerId: string, model: string, o: CallOutcome): LlmCallResult {
  return {
    providerId,
    model,
    ok: o.ok,
    text: o.text,
    structured: o.structured,
    usage: o.usage,
    costUsd: o.costUsd,
    durationMs: o.durationMs,
    error: o.error,
  };
}
