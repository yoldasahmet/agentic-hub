import { z } from "zod";

export const RUN_JOB_KIND = "run";

/**
 * What a run job does: start from the run's input, resume a gate, or
 * continue from the latest checkpoint (forks and crash recovery).
 * `fromCheckpointId` is the thread's head when the job was queued, so a
 * retry can tell whether the first attempt got anywhere.
 */
export const runJobPayloadSchema = z.object({
  mode: z.enum(["input", "resume", "continue"]),
  resume: z.json().optional(),
  /** Answers only this interrupt when several wait at once. */
  interruptId: z.string().optional(),
  fromCheckpointId: z.string().nullable(),
});
export type RunJobPayload = z.infer<typeof runJobPayloadSchema>;
