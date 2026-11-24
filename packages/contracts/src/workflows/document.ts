import { z } from "zod";
import { fieldsToSchema } from "../agents/io-schema";
import { idSchema } from "../ids";
import { jsonSchemaSchema } from "../llm/request";
import { bindingsSchema, jsonLogicRuleSchema } from "./bindings";

/**
 * Node ids double as LangGraph node names and as `nodes.<id>` paths in
 * conditions, so they are short and simple. `__` is reserved for the
 * review steps the compiler adds (`<id>__input`, `<id>__output`).
 */
export const workflowNodeIdSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, digits, and _ (letter first)")
  .refine((id) => !id.includes("__"), "`__` is reserved");
export type WorkflowNodeId = z.infer<typeof workflowNodeIdSchema>;

/** `latest` follows the newest published version in drafts; publishing pins a number. */
export const versionPinSchema = z.union([z.literal("latest"), z.number().int().positive()]);
export type VersionPin = z.infer<typeof versionPinSchema>;

export const positionSchema = z.object({ x: z.number(), y: z.number() });

/** Retries of a failed node, inside the run (a gate or a cancel is never retried). */
export const nodeRetrySchema = z.object({
  maxAttempts: z.number().int().min(1).max(5).default(1),
  backoffMs: z.number().int().min(0).max(300_000).default(2000),
});
export type NodeRetry = z.infer<typeof nodeRetrySchema>;

const nodeBase = {
  id: workflowNodeIdSchema,
  label: z.string().max(80).default(""),
  position: positionSchema.default({ x: 0, y: 0 }),
  enabled: z.boolean().default(true),
  /** Field of the node's input → where its value comes from. */
  bindings: bindingsSchema.default({}),
  /** Pause before the node so a person can review and edit its input. */
  reviewInput: z.boolean().default(false),
  /** Pause after the node so a person can review and edit its output. */
  reviewOutput: z.boolean().default(false),
  /** With several incoming edges: `all` waits for every running branch (a join), `any` runs per arrival. */
  join: z.enum(["all", "any"]).default("all"),
  retry: nodeRetrySchema.optional(),
};

export const agentNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("agent"),
  agentId: idSchema,
  version: versionPinSchema.default("latest"),
});
export const subworkflowNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("workflow"),
  workflowId: idSchema,
  version: versionPinSchema.default("latest"),
});
/** A human gate: shows its bound data, which a person approves, edits, or rejects. */
export const gateNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("gate"),
  title: z.string().max(120).default("Approve to continue"),
  /** Shown to the reviewer; `{{input.x}}` reads the gate's bound data. */
  message: z.string().max(10_000).default(""),
  /** The fields the gate shows and the reviewer may edit. Its bindings fill them. */
  schema: jsonSchemaSchema.default(() => fieldsToSchema([])),
  /** `stop` fails the run on reject; `continue` records `approved: false` for conditions. */
  onReject: z.enum(["stop", "continue"]).default("stop"),
});

export const workflowNodeSchema = z.discriminatedUnion("kind", [
  agentNodeSchema,
  subworkflowNodeSchema,
  gateNodeSchema,
]);
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowNodeInput = z.input<typeof workflowNodeSchema>;
export type WorkflowNodeKind = WorkflowNode["kind"];
export type AgentWorkflowNode = z.infer<typeof agentNodeSchema>;
export type SubworkflowNode = z.infer<typeof subworkflowNodeSchema>;
export type GateNode = z.infer<typeof gateNodeSchema>;

/**
 * Several outgoing edges run in parallel. A `condition` decides whether an
 * edge is followed. `maxIterations` marks a loop edge: it is followed while
 * its target has run at most that many times.
 */
export const workflowEdgeSchema = z.object({
  id: z.string().min(1).max(64),
  from: workflowNodeIdSchema,
  to: workflowNodeIdSchema,
  condition: jsonLogicRuleSchema.nullable().default(null),
  maxIterations: z.number().int().min(1).max(100).nullable().default(null),
  label: z.string().max(80).default(""),
});
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

/** One versioned document: I/O, the graph, and the output mapping (D10). */
export const workflowDocumentSchema = z.object({
  inputSchema: jsonSchemaSchema,
  outputSchema: jsonSchemaSchema,
  /** Output field → source. Empty: the merged outputs of the exit nodes. */
  outputs: bindingsSchema.default({}),
  nodes: z.array(workflowNodeSchema).max(200).default([]),
  edges: z.array(workflowEdgeSchema).max(500).default([]),
});
export type WorkflowDocument = z.infer<typeof workflowDocumentSchema>;
export type WorkflowDocumentInput = z.input<typeof workflowDocumentSchema>;

/** A new workflow: one `task` input and no nodes yet. */
export function defaultWorkflowDocument(): WorkflowDocument {
  return workflowDocumentSchema.parse({
    inputSchema: fieldsToSchema([
      { name: "task", type: "long", description: "What to do", required: true },
    ]),
    outputSchema: fieldsToSchema([]),
  });
}
