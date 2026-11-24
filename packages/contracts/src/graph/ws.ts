import { z } from "zod";
import { terminalClientMessageSchemas, terminalServerMessageSchemas } from "../chat/terminals";
import { appErrorSchema } from "../errors";
import { idSchema } from "../ids";
import { runEventSchema } from "./run-events";
import { runSchema } from "./runs";

/**
 * One socket per client. `subscribe` replays a run's events after `after`,
 * then streams live ones; a reconnecting client sends its last seen seq.
 * `watch-runs` streams every run change in the workspace (no replay).
 * `terminal.*` carries terminal-mode sessions (chat/terminals.ts).
 */
export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), runId: idSchema, after: z.number().int().min(0) }),
  z.object({ type: z.literal("unsubscribe"), runId: idSchema }),
  z.object({ type: z.literal("watch-runs") }),
  ...terminalClientMessageSchemas,
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: runEventSchema }),
  z.object({ type: z.literal("run"), run: runSchema }),
  z.object({ type: z.literal("error"), error: appErrorSchema }),
  ...terminalServerMessageSchemas,
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;
