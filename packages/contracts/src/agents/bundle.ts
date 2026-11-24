import { z } from "zod";
import { identityColorSchema, identityIconSchema } from "../identity";
import { slugSchema } from "../ids";
import { agentSpecSchema } from "./spec";

/**
 * A portable agent: identity plus spec, as JSON or YAML. Built-ins ship in
 * this format, and team DBs exchange agents through it (no data moves
 * automatically between databases).
 */
export const agentBundleSchema = z.object({
  format: z.literal("agentic.agent"),
  formatVersion: z.literal(1),
  agent: z.object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    color: identityColorSchema,
    icon: identityIconSchema,
    spec: agentSpecSchema,
  }),
});
export type AgentBundle = z.infer<typeof agentBundleSchema>;
export type AgentBundleInput = z.input<typeof agentBundleSchema>;

export const bundleFormatSchema = z.enum(["json", "yaml"]);
export type BundleFormat = z.infer<typeof bundleFormatSchema>;

export const importAgentInputSchema = z.object({
  format: bundleFormatSchema,
  content: z.string().min(1).max(1_000_000),
});
export type ImportAgentInput = z.infer<typeof importAgentInputSchema>;

export const exportAgentQuerySchema = z.object({ format: bundleFormatSchema.default("json") });

export const agentExportSchema = z.object({ filename: z.string(), content: z.string() });
export type AgentExport = z.infer<typeof agentExportSchema>;

/** A built-in agent the library offers; `installed` when the workspace has its slug. */
export const builtinAgentSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  description: z.string(),
  color: identityColorSchema,
  icon: identityIconSchema,
  installed: z.boolean(),
});
export type BuiltinAgent = z.infer<typeof builtinAgentSchema>;

export const builtinSlugParamSchema = z.object({ slug: slugSchema });
