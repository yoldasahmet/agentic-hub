import { z } from "zod";
import { agentBundleSchema } from "../agents/bundle";
import { identityColorSchema, identityIconSchema } from "../identity";
import { slugSchema } from "../ids";
import { bundledMcpServerSchema } from "../tools/mcp";
import { bundledSkillSchema } from "../tools/skills";
import {
  agentNodeSchema,
  gateNodeSchema,
  subworkflowNodeSchema,
  workflowDocumentSchema,
} from "./document";

/** In a bundle, nodes name agents and subworkflows by slug; import maps slugs to ids. */
const bundleAgentNodeSchema = agentNodeSchema
  .omit({ agentId: true, version: true })
  .extend({ agent: slugSchema });
const bundleSubworkflowNodeSchema = subworkflowNodeSchema
  .omit({ workflowId: true, version: true })
  .extend({ workflow: slugSchema });
export const bundleNodeSchema = z.discriminatedUnion("kind", [
  bundleAgentNodeSchema,
  bundleSubworkflowNodeSchema,
  gateNodeSchema,
]);
export type BundleNode = z.infer<typeof bundleNodeSchema>;

export const bundleDocumentSchema = workflowDocumentSchema.extend({
  nodes: z.array(bundleNodeSchema).max(200).default([]),
});
export type BundleDocument = z.infer<typeof bundleDocumentSchema>;

/**
 * A portable workflow (templates, export/import). Agents, skills, and MCP
 * servers it uses travel with it; on import, a slug (or server name) the
 * workspace already has is reused.
 */
export const workflowBundleSchema = z.object({
  format: z.literal("agentic.workflow"),
  formatVersion: z.literal(1),
  workflow: z.object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    color: identityColorSchema,
    icon: identityIconSchema,
    document: bundleDocumentSchema,
  }),
  agents: z.array(agentBundleSchema).default([]),
  skills: z.array(bundledSkillSchema).max(50).default([]),
  mcpServers: z.array(bundledMcpServerSchema).max(20).default([]),
});
export type WorkflowBundle = z.infer<typeof workflowBundleSchema>;
export type WorkflowBundleInput = z.input<typeof workflowBundleSchema>;

/** A template the library offers; `installed` when the workspace has its slug. */
export const workflowTemplateSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  description: z.string(),
  color: identityColorSchema,
  icon: identityIconSchema,
  nodes: z.number().int(),
  installed: z.boolean(),
});
export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>;

export const templateSlugParamSchema = z.object({ slug: slugSchema });
