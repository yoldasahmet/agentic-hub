import { z } from "zod";
import { appErrorSchema } from "../errors";
import { idSchema, isoDateTimeSchema } from "../ids";
import { runStatusSchema } from "../status";
import { assistantIdSchema } from "./assistants";
import { interruptSchema } from "./threads";

/** Any JSON value: run inputs and gate answers must survive a round trip through JSON. */
export const jsonValueSchema = z.json();
export type JsonValue = z.infer<typeof jsonValueSchema>;

/** One execution of an assistant on a thread. It stays one run across its human gates. */
export const runSchema = z.object({
  id: idSchema,
  threadId: idSchema,
  assistantId: assistantIdSchema,
  assistantVersion: z.number().int().positive(),
  status: runStatusSchema,
  input: z.unknown(),
  output: z.unknown(),
  error: appErrorSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});
export type Run = z.infer<typeof runSchema>;

/**
 * Starts a run. Without `threadId` a new thread is created for it. On an
 * existing thread, `resume` answers its pending gate, `input` starts over
 * from new input, and neither continues from the latest checkpoint (forks).
 */
export const createRunInputSchema = z.object({
  assistantId: assistantIdSchema,
  threadId: idSchema.optional(),
  /** Pins a new thread to this version instead of the latest. Ignored on an existing thread. */
  assistantVersion: z.number().int().positive().optional(),
  input: z.record(z.string(), jsonValueSchema).optional(),
  resume: jsonValueSchema.optional(),
});
export type CreateRunInput = z.input<typeof createRunInputSchema>;

/** The value `interrupt()` returns inside the graph when the run resumes. */
export const resumeRunInputSchema = z.object({
  resume: jsonValueSchema,
  /** Which gate this answers, when several wait at once (parallel branches). */
  interruptId: z.string().min(1).max(200).optional(),
});
export type ResumeRunInput = z.infer<typeof resumeRunInputSchema>;

export const runListQuerySchema = z.object({
  threadId: idSchema.optional(),
  assistantId: assistantIdSchema.optional(),
  status: runStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type RunListQuery = z.infer<typeof runListQuerySchema>;

/** `POST /runs/wait` and `/runs/:id/wait` return once the run stops or the timeout ends. */
export const waitQuerySchema = z.object({
  timeoutMs: z.coerce.number().int().min(100).max(600_000).default(60_000),
});
export type WaitQuery = z.infer<typeof waitQuerySchema>;

/** A human gate the Inbox shows: the waiting run and what its graph asked. */
export const pendingInterruptSchema = z.object({
  run: runSchema,
  interrupts: z.array(interruptSchema),
});
export type PendingInterrupt = z.infer<typeof pendingInterruptSchema>;

export const runEventsQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type RunEventsQuery = z.infer<typeof runEventsQuerySchema>;

export const runIdParamSchema = z.object({ runId: idSchema });
export const threadIdParamSchema = z.object({ threadId: idSchema });
