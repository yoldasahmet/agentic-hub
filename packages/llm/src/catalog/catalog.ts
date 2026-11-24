import { type LlmCatalog, llmCatalogSchema, type ModelInfo } from "@agentic/contracts";
import raw from "../../config/llm-catalog.json" with { type: "json" };

export type CatalogModel = ModelInfo & { isDefault: boolean };

/**
 * The model catalog is data (`config/llm-catalog.json`), parsed once with
 * Zod so a bad edit fails loudly at startup instead of at call time.
 */
export class ModelCatalog {
  private readonly byProvider: Map<string, CatalogModel[]>;

  constructor(readonly data: LlmCatalog = llmCatalogSchema.parse(raw)) {
    this.byProvider = new Map(
      data.providers.map((p) => [p.id, p.models.map((m) => ({ ...m, providerId: p.id }))]),
    );
  }

  models(providerId: string): CatalogModel[] {
    return this.byProvider.get(providerId) ?? [];
  }

  find(providerId: string, modelId: string): CatalogModel | undefined {
    return this.models(providerId).find((m) => m.modelId === modelId);
  }

  reasoningOptions(providerId: string): string[] {
    return this.data.providers.find((p) => p.id === providerId)?.reasoningOptions ?? [];
  }
}
