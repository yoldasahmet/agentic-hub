import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../ids";
import { assistantIdSchema } from "./assistants";

/** Open set stored as text: `interrupted` means a human gate waits for input. */
export const threadStatuses = ["idle", "busy", "interrupted", "error"] as const;
export const threadStatusSchema = z.enum(threadStatuses);
export type ThreadStatus = z.infer<typeof threadStatusSchema>;

export const stateValuesSchema = z.record(z.string(), z.unknown());
export type StateValues = z.infer<typeof stateValuesSchema>;

export const threadSchema = z.object({
  id: idSchema,
  assistantId: assistantIdSchema,
  assistantVersion: z.number().int().positive(),
  status: threadStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  forkedFrom: z.object({ threadId: idSchema, checkpointId: z.string() }).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Thread = z.infer<typeof threadSchema>;

/** A value passed to `interrupt()`, waiting for `Command({ resume })`. */
export const interruptSchema = z.object({
  id: z.string(),
  node: z.string(),
  value: z.unknown(),
});
export type Interrupt = z.infer<typeof interruptSchema>;

/** One LangGraph checkpoint, as the API and the StateInspector see it. */
export const checkpointSchema = z.object({
  checkpointId: z.string(),
  parentCheckpointId: z.string().nullable(),
  values: stateValuesSchema,
  next: z.array(z.string()),
  interrupts: z.array(interruptSchema),
  step: z.number().int(),
  source: z.string(),
  /** The node writes that produced this checkpoint, when the saver recorded them. */
  writes: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoDateTimeSchema.nullable(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

export const threadStateSchema = z.object({
  thread: threadSchema,
  state: checkpointSchema.nullable(),
});
export type ThreadState = z.infer<typeof threadStateSchema>;

export const threadListQuerySchema = z.object({
  status: threadStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ThreadListQuery = z.infer<typeof threadListQuerySchema>;

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().min(1).optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/** Writes `values` as if `asNode` produced them, on top of `checkpointId` (default: latest). */
export const updateStateInputSchema = z.object({
  values: stateValuesSchema,
  asNode: z.string().min(1).optional(),
  checkpointId: z.string().min(1).optional(),
});
export type UpdateStateInput = z.infer<typeof updateStateInputSchema>;

/**
 * Copies one checkpoint into a new thread, which then runs on its own.
 * `keepPendingWrites: false` drops what that step already did (answers,
 * finished branches), so all of its nodes run again: "retry from here".
 */
export const forkThreadInputSchema = z.object({
  checkpointId: z.string().min(1),
  keepPendingWrites: z.boolean().default(true),
});
export type ForkThreadInput = z.input<typeof forkThreadInputSchema>;

export const checkpointRefSchema = z.object({ threadId: idSchema, checkpointId: z.string() });
export type CheckpointRef = z.infer<typeof checkpointRefSchema>;
