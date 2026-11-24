import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./ids";

/**
 * Envelope for every persisted run event. `seq` is gap-free per run, so
 * clients reconnect with `after=<seq>` and replay exactly what they missed.
 */
export const eventEnvelopeSchema = z.object({
  id: idSchema,
  runId: idSchema,
  seq: z.number().int().nonnegative(),
  type: z.string().min(1),
  at: isoDateTimeSchema,
  payload: z.unknown(),
});
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

/**
 * Declares one typed event. Feature modules combine these with
 * `z.discriminatedUnion("type", [...])`, so new event types never need a
 * database migration (the column is plain text).
 */
export function defineEvent<const T extends string, P extends z.ZodType>(type: T, payload: P) {
  return eventEnvelopeSchema.extend({ type: z.literal(type), payload });
}
