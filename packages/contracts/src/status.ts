import { z } from "zod";

/** Lifecycle of a run or chat turn. `waiting` means a human gate needs input. */
export const runStatuses = [
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "canceled",
] as const;
export const runStatusSchema = z.enum(runStatuses);
export type RunStatus = z.infer<typeof runStatusSchema>;
