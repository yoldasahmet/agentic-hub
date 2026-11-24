import { z } from "zod";
import { idSchema } from "../ids";
import { modelRefSchema } from "../llm/calls";
import { llmEventSchema, llmUsageSchema } from "../llm/events";
import { toolCallEventSchema } from "../tools/tools";
import { agentSpecSchema } from "./spec";

/**
 * Assistant ids for agents. A published version runs as `agent:<id>` pinned
 * to its version; a draft runs as `agent-draft:<id>` with a snapshot of the
 * draft in its input, so editing the draft never changes a running test.
 */
export const AGENT_ASSISTANT_PREFIX = "agent:";
export const AGENT_DRAFT_ASSISTANT_PREFIX = "agent-draft:";

export const agentAssistantId = (agentId: string) => `${AGENT_ASSISTANT_PREFIX}${agentId}`;
export const agentDraftAssistantId = (agentId: string) =>
  `${AGENT_DRAFT_ASSISTANT_PREFIX}${agentId}`;

export type AgentAssistantRef = { agentId: string; draft: boolean };

export function parseAgentAssistantId(assistantId: string): AgentAssistantRef | undefined {
  const draft = assistantId.startsWith(AGENT_DRAFT_ASSISTANT_PREFIX);
  if (!draft && !assistantId.startsWith(AGENT_ASSISTANT_PREFIX)) return undefined;
  const prefix = draft ? AGENT_DRAFT_ASSISTANT_PREFIX : AGENT_ASSISTANT_PREFIX;
  const id = idSchema.safeParse(assistantId.slice(prefix.length));
  return id.success ? { agentId: id.data, draft } : undefined;
}

/** The input of an agent graph run. `spec` is set only for draft runs. */
export const agentRunStateInputSchema = z.object({
  input: z.record(z.string(), z.json()),
  model: modelRefSchema.optional(),
  spec: agentSpecSchema.optional(),
});
export type AgentRunStateInput = z.infer<typeof agentRunStateInputSchema>;

/**
 * What an agent node sends with `config.writer` (run events of type
 * `custom`): which model an attempt uses, its LLM events as they stream,
 * and each tool call.
 */
export const agentStreamEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attempt"), model: modelRefSchema, attempt: z.number().int() }),
  z.object({ kind: z.literal("llm"), event: llmEventSchema }),
  toolCallEventSchema,
]);
export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;

/** What an agent node writes when it finishes, alongside `output`. */
export const agentRunReportSchema = z.object({
  model: modelRefSchema.optional(),
  usage: llmUsageSchema.optional(),
  costUsd: z.number().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
});
export type AgentRunReport = z.infer<typeof agentRunReportSchema>;

/** The gate a `human` agent raises: a question and the schema its answer must match. */
export const humanAgentRequestSchema = z.object({
  kind: z.literal("agent.human"),
  question: z.string(),
  outputSchema: z.record(z.string(), z.unknown()),
  input: z.record(z.string(), z.json()),
  issues: z.array(z.string()).default([]),
});
export type HumanAgentRequest = z.infer<typeof humanAgentRequestSchema>;

/** Named inputs saved from the playground, to rerun later. */
export const agentTestInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  input: z.record(z.string(), z.json()),
});
export type AgentTestInput = z.infer<typeof agentTestInputSchema>;
export const agentTestInputsSchema = z.array(agentTestInputSchema).max(50);
