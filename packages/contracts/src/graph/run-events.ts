import { z } from "zod";
import { appErrorSchema } from "../errors";
import { defineEvent } from "../events";
import { runStatusSchema } from "../status";
import { interruptSchema } from "./threads";

/**
 * Events a run emits, persisted to `run_events` before broadcast. The type
 * column is text, so adding an event here never needs a migration.
 */
export const runStatusEventSchema = defineEvent(
  "run.status",
  z.object({ status: runStatusSchema, error: appErrorSchema.optional() }),
);
/** A node finished: `update` is what it wrote to the state (stream mode `updates`). */
export const nodeUpdatedEventSchema = defineEvent(
  "node.updated",
  z.object({ node: z.string(), update: z.unknown() }),
);
/** Streamed LLM text (stream mode `messages`). */
export const messageDeltaEventSchema = defineEvent(
  "message.delta",
  z.object({ node: z.string().nullable(), content: z.string() }),
);
/** Anything a node sent with `config.writer` (stream mode `custom`). */
export const customEventSchema = defineEvent("custom", z.object({ data: z.unknown() }));
export const runInterruptedEventSchema = defineEvent(
  "run.interrupted",
  z.object({ interrupts: z.array(interruptSchema) }),
);
export const runOutputEventSchema = defineEvent("run.output", z.object({ output: z.unknown() }));

export const runEventSchema = z.discriminatedUnion("type", [
  runStatusEventSchema,
  nodeUpdatedEventSchema,
  messageDeltaEventSchema,
  customEventSchema,
  runInterruptedEventSchema,
  runOutputEventSchema,
]);
export type RunEvent = z.infer<typeof runEventSchema>;
export type RunEventType = RunEvent["type"];
/** An event before it is persisted: the log assigns `id`, `seq`, and `at`. */
export type RunEventDraft = {
  [T in RunEvent as T["type"]]: Pick<T, "type" | "payload">;
}[RunEventType];

export const runEventPageSchema = z.object({ items: z.array(runEventSchema), lastSeq: z.number() });
export type RunEventPage = z.infer<typeof runEventPageSchema>;
