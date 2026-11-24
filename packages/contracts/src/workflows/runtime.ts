import { z } from "zod";
import { agentRunReportSchema, agentStreamEventSchema } from "../agents/runtime";
import { appErrorSchema } from "../errors";
import { idSchema } from "../ids";
import { jsonSchemaSchema } from "../llm/request";

/**
 * Assistant ids for workflows. A published version runs as `workflow:<id>`
 * pinned to its version; a draft run pins a snapshot of the draft, stored
 * per revision, as `workflow-draft:<id>` at version = revision + 1
 * (assistant versions start at 1, revisions at 0).
 */
export const WORKFLOW_ASSISTANT_PREFIX = "workflow:";
export const WORKFLOW_DRAFT_ASSISTANT_PREFIX = "workflow-draft:";

export const workflowAssistantId = (id: string) => `${WORKFLOW_ASSISTANT_PREFIX}${id}`;
export const workflowDraftAssistantId = (id: string) => `${WORKFLOW_DRAFT_ASSISTANT_PREFIX}${id}`;

export const draftAssistantVersion = (revision: number) => revision + 1;
export const draftRevisionOf = (assistantVersion: number) => assistantVersion - 1;

export function parseWorkflowAssistantId(
  assistantId: string,
): { workflowId: string; draft: boolean } | undefined {
  const draft = assistantId.startsWith(WORKFLOW_DRAFT_ASSISTANT_PREFIX);
  if (!draft && !assistantId.startsWith(WORKFLOW_ASSISTANT_PREFIX)) return undefined;
  const prefix = draft ? WORKFLOW_DRAFT_ASSISTANT_PREFIX : WORKFLOW_ASSISTANT_PREFIX;
  const id = idSchema.safeParse(assistantId.slice(prefix.length));
  return id.success ? { workflowId: id.data, draft } : undefined;
}

/** Graph node names: a workflow node, or a review step the compiler added around it. */
export const reviewStepName = (node: string, stage: "input" | "output") => `${node}__${stage}`;
export const nodeOfStep = (step: string) => step.split("__")[0] ?? step;

export const nodeStatuses = ["running", "succeeded", "failed", "rejected"] as const;
export const nodeStatusSchema = z.enum(nodeStatuses);
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

/** What a node left in the `nodes` channel of a workflow thread. */
export const nodeSlotSchema = z.object({
  status: nodeStatusSchema,
  output: z.record(z.string(), z.unknown()).default({}),
  /** How many times the node ran: loop edges compare it with `maxIterations`. */
  runs: z.number().int().nonnegative().default(0),
  report: agentRunReportSchema.optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});
export type NodeSlot = z.infer<typeof nodeSlotSchema>;

/** The state of a workflow thread, parsed leniently for views. */
export const workflowStateSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  nodes: z.record(z.string(), nodeSlotSchema).default({}),
  output: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowState = z.infer<typeof workflowStateSchema>;

/** A gate node waiting for a person. `message` is already rendered. */
export const workflowGateRequestSchema = z.object({
  kind: z.literal("workflow.gate"),
  node: z.string(),
  title: z.string(),
  message: z.string(),
  schema: jsonSchemaSchema,
  data: z.record(z.string(), z.json()),
  issues: z.array(z.string()).default([]),
});
export type WorkflowGateRequest = z.infer<typeof workflowGateRequestSchema>;

/** A node paused for review of its input (before) or output (after). */
export const workflowReviewRequestSchema = z.object({
  kind: z.literal("workflow.review"),
  node: z.string(),
  stage: z.enum(["input", "output"]),
  label: z.string(),
  schema: jsonSchemaSchema,
  data: z.record(z.string(), z.json()),
  issues: z.array(z.string()).default([]),
});
export type WorkflowReviewRequest = z.infer<typeof workflowReviewRequestSchema>;

/** The answer to a gate or review: `data` replaces what was shown when given. */
export const gateAnswerSchema = z.object({
  action: z.enum(["approve", "reject"]),
  data: z.record(z.string(), z.json()).optional(),
  comment: z.string().max(10_000).optional(),
});
export type GateAnswer = z.infer<typeof gateAnswerSchema>;

/**
 * What workflow steps send with `config.writer`: node status changes and
 * each agent node's own stream events. `ns` is non-empty inside a subworkflow.
 */
export const workflowStreamEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workflow.node"),
    node: z.string(),
    ns: z.string().default(""),
    status: nodeStatusSchema,
    attempt: z.number().int().optional(),
    error: appErrorSchema.optional(),
  }),
  z.object({
    kind: z.literal("workflow.agent"),
    node: z.string(),
    ns: z.string().default(""),
    event: agentStreamEventSchema,
  }),
]);
export type WorkflowStreamEvent = z.infer<typeof workflowStreamEventSchema>;
