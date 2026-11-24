import { z } from "zod";
import { modelRefSchema } from "../llm/calls";
import { jsonSchemaSchema, reasoningEffortSchema } from "../llm/request";
import { approvalPolicySchema, defaultApprovalPolicy } from "../tools/tools";
import { fieldsToSchema } from "./io-schema";

/**
 * What an agent does, as data (no role-specific code, R7):
 * - `llm` renders its prompt, calls a model, and validates the answer;
 * - `tool` calls one registered tool with its inputs;
 * - `human` asks a person at a gate and validates their answer.
 */
export const agentKinds = ["llm", "tool", "human"] as const;
export const agentKindSchema = z.enum(agentKinds);
export type AgentKind = z.infer<typeof agentKindSchema>;

/** How the output is shown. Renderers are a registry in packages/ui (P6.6). */
export const outputFormats = ["markdown", "json", "plan", "diff", "html", "table"] as const;
export const outputFormatSchema = z.enum(outputFormats);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

/** Where a CLI-backed call runs: a private scratch dir, a fixed path, or a path from an input. */
export const workingDirPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("scratch") }),
  z.object({ mode: z.literal("fixed"), path: z.string().min(1).max(1024) }),
  z.object({ mode: z.literal("input"), field: z.string().min(1).max(64) }),
  /**
   * A git worktree of its own per run, on branch `agentic/<run>`. The input
   * field names the repo: `owner/name` (cloned from GitHub) or a local repo
   * path inside an allowed folder. Every node of the run shares it.
   */
  z.object({ mode: z.literal("worktree"), field: z.string().min(1).max(64) }),
]);
export type WorkingDirPolicy = z.infer<typeof workingDirPolicySchema>;

export const agentPromptSchema = z.object({
  system: z.string().max(100_000).default(""),
  /** The user message, with `{{input.<field>}}` placeholders. Empty sends the inputs as JSON. */
  template: z.string().max(100_000).default(""),
});
export type AgentPrompt = z.infer<typeof agentPromptSchema>;

export const agentRuntimeSchema = z.object({
  model: modelRefSchema.optional(),
  reasoning: reasoningEffortSchema.optional(),
  /** Tried in order when the model fails (not when its answer is invalid). */
  fallbacks: z.array(modelRefSchema).max(4).default([]),
  workingDir: workingDirPolicySchema.default({ mode: "scratch" }),
  timeoutMs: z.number().int().min(10_000).max(3_600_000).default(600_000),
  /** Repair rounds when an answer doesn't match the output schema. */
  maxRepairs: z.number().int().min(0).max(3).default(2),
  /** The tool a `tool` agent calls. */
  tool: z.string().max(200).optional(),
});
export type AgentRuntime = z.infer<typeof agentRuntimeSchema>;

/**
 * Slots filled from the tool, MCP, and skill registries by name, not
 * copies, so a version picks up a server's new tools. `approval` decides
 * per permission level whether a call runs, waits for a person, or is refused.
 */
export const agentCapabilitiesSchema = z.object({
  tools: z.array(z.string().max(200)).max(100).default([]),
  mcpServers: z.array(z.string().max(200)).max(50).default([]),
  skills: z.array(z.string().max(200)).max(50).default([]),
  approval: approvalPolicySchema.default(defaultApprovalPolicy),
});
export type AgentCapabilities = z.infer<typeof agentCapabilitiesSchema>;

/** Everything a version pins. The draft has the same shape and autosaves. */
export const agentSpecSchema = z.object({
  kind: agentKindSchema,
  inputSchema: jsonSchemaSchema,
  /** No fields: the answer is free text, stored as `{ text }`. */
  outputSchema: jsonSchemaSchema,
  outputFormat: outputFormatSchema.default("markdown"),
  prompt: agentPromptSchema.default({ system: "", template: "" }),
  runtime: agentRuntimeSchema.default({
    fallbacks: [],
    workingDir: { mode: "scratch" },
    timeoutMs: 600_000,
    maxRepairs: 2,
  }),
  capabilities: agentCapabilitiesSchema.default({
    tools: [],
    mcpServers: [],
    skills: [],
    approval: defaultApprovalPolicy,
  }),
});
export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type AgentSpecInput = z.input<typeof agentSpecSchema>;

/** A new agent: one long `task` input and a free-text answer. */
export function defaultAgentSpec(kind: AgentKind = "llm"): AgentSpec {
  return agentSpecSchema.parse({
    kind,
    inputSchema: fieldsToSchema([
      { name: "task", type: "long", description: "What to do", required: true },
    ]),
    outputSchema: fieldsToSchema([]),
    prompt: { system: "", template: "{{input.task}}" },
  });
}
