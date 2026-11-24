import { z } from "zod";
import { coreStatusSchema } from "../core/runtime";
import { databaseStatusSchema } from "../database";

/** Commands the native menu sends to the renderer (shortcuts live in the menu). */
export const menuCommandSchema = z.enum(["command-palette", "new-chat", "settings"]);
export type MenuCommand = z.infer<typeof menuCommandSchema>;

/** One-way events from main to the renderer. */
export const ipcEvents = {
  "menu.command": menuCommandSchema,
  "database.status": databaseStatusSchema,
  "core.status": coreStatusSchema,
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<E extends IpcEvent> = z.output<(typeof ipcEvents)[E]>;

export const ipcEventNames = Object.keys(ipcEvents) as IpcEvent[];

/** The payload schema for one event, typed per event (see `ipcContract` for why). */
export function ipcEventSchema<E extends IpcEvent>(event: E): z.ZodType<IpcEventPayload<E>> {
  return ipcEvents[event] as unknown as z.ZodType<IpcEventPayload<E>>;
}
