import { z } from "zod";
import { isoDateTimeSchema } from "../ids";

/** A 256-bit per-launch token, hex encoded. Every request to Core carries it. */
export const coreTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * `<dataDir>/runtime/core.json` (mode 0600): how the CLI finds the running
 * Core. Deleted when Core stops; a stale file fails the pid check.
 */
export const coreRuntimeInfoSchema = z.object({
  url: z.url({ protocol: /^http$/, hostname: /^127\.0\.0\.1$/ }),
  port: z.number().int().min(1).max(65_535),
  token: coreTokenSchema,
  pid: z.number().int().positive(),
  version: z.string(),
  startedAt: isoDateTimeSchema,
});
export type CoreRuntimeInfo = z.infer<typeof coreRuntimeInfoSchema>;

export const coreStateSchema = z.enum(["starting", "ready", "error", "stopped"]);
export type CoreState = z.infer<typeof coreStateSchema>;

/** What the renderer needs to reach Core. `url` and `token` are set when ready. */
export const coreStatusSchema = z.object({
  state: coreStateSchema,
  url: z.string().optional(),
  token: coreTokenSchema.optional(),
  error: z.string().optional(),
  restarts: z.number().int().nonnegative(),
});
export type CoreStatus = z.infer<typeof coreStatusSchema>;

/** `GET /health`: unauthenticated, so it says nothing beyond "Core is up". */
export const healthSchema = z.object({ status: z.literal("ok"), version: z.string() });
export type Health = z.infer<typeof healthSchema>;
