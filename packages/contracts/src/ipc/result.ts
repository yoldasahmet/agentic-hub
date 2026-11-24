import { z } from "zod";
import { appErrorSchema } from "../errors";

/**
 * Every IPC reply is an envelope. Errors thrown in main lose their fields
 * when Electron serializes them, so main returns them as data instead.
 */
export function ipcResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: appErrorSchema }),
  ]);
}
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: z.infer<typeof appErrorSchema> };
