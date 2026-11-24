import {
  type ModelInfo,
  type ModelPricing,
  modelPricingSchema,
  modelSourceSchema,
  modelTierSchema,
} from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const { models } = schema;

/** The `capabilities` jsonb, parsed on read: it's an open bag in the DB. */
const storedCapabilities = z.object({
  source: modelSourceSchema.catch("catalog"),
  tier: modelTierSchema.optional().catch(undefined),
  contextWindow: z.number().int().positive().optional().catch(undefined),
  supportsReasoning: z.boolean().catch(false),
});

export type StoredModel = ModelInfo & { source: "catalog" | "openrouter"; enabled: boolean };

/** Per-workspace model choices: enabled flags and synced OpenRouter models. */
export class ModelRepository {
  constructor(private readonly db: Database) {}

  async list(ctx: Pick<LocalContext, "workspaceId">): Promise<StoredModel[]> {
    const rows = await this.db.select().from(models).where(eq(models.workspaceId, ctx.workspaceId));
    return rows.map((row) => {
      const caps = storedCapabilities.parse(row.capabilities ?? {});
      const pricing = modelPricingSchema.safeParse(row.pricing);
      return {
        providerId: row.providerId,
        modelId: row.modelId,
        label: row.displayName,
        tier: caps.tier,
        contextWindow: caps.contextWindow,
        supportsReasoning: caps.supportsReasoning,
        pricing: pricing.success ? pricing.data : undefined,
        source: caps.source,
        enabled: row.enabled,
      };
    });
  }

  async setEnabled(ctx: LocalContext, model: StoredModel): Promise<void> {
    await this.upsert(ctx, [model], { updateEnabled: true });
  }

  /** Synced models keep the enabled flag the user already chose. */
  async upsertSynced(ctx: LocalContext, synced: ModelInfo[]): Promise<void> {
    const rows = synced.map((m) => ({ ...m, source: "openrouter" as const, enabled: false }));
    for (let i = 0; i < rows.length; i += 500) {
      await this.upsert(ctx, rows.slice(i, i + 500), { updateEnabled: false });
    }
  }

  private async upsert(
    ctx: LocalContext,
    list: StoredModel[],
    { updateEnabled }: { updateEnabled: boolean },
  ): Promise<void> {
    if (list.length === 0) return;
    await this.db
      .insert(models)
      .values(
        list.map((m) => ({
          workspaceId: ctx.workspaceId,
          createdBy: ctx.userId,
          providerId: m.providerId,
          modelId: m.modelId,
          displayName: m.label,
          capabilities: {
            source: m.source,
            tier: m.tier,
            contextWindow: m.contextWindow,
            supportsReasoning: m.supportsReasoning,
          },
          pricing: m.pricing ?? null,
          enabled: m.enabled,
        })),
      )
      .onConflictDoUpdate({
        target: [models.workspaceId, models.providerId, models.modelId],
        set: {
          displayName: sql`excluded.display_name`,
          capabilities: sql`excluded.capabilities`,
          pricing: sql`excluded.pricing`,
          ...(updateEnabled ? { enabled: sql`excluded.enabled` } : {}),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Any workspace's synced price for a model. Prices are public catalog
   * data, and agent nodes run in the worker without a request context.
   */
  async anyPricing(providerId: string, modelId: string): Promise<ModelPricing | undefined> {
    const [row] = await this.db
      .select({ pricing: models.pricing })
      .from(models)
      .where(and(eq(models.providerId, providerId), eq(models.modelId, modelId)))
      .limit(1);
    const parsed = modelPricingSchema.safeParse(row?.pricing);
    return parsed.success ? parsed.data : undefined;
  }

  async pricing(
    ctx: LocalContext,
    providerId: string,
    modelId: string,
  ): Promise<ModelPricing | undefined> {
    const [row] = await this.db
      .select({ pricing: models.pricing })
      .from(models)
      .where(
        and(
          eq(models.workspaceId, ctx.workspaceId),
          eq(models.providerId, providerId),
          eq(models.modelId, modelId),
        ),
      )
      .limit(1);
    const parsed = modelPricingSchema.safeParse(row?.pricing);
    return parsed.success ? parsed.data : undefined;
  }
}
