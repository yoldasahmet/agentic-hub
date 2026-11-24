import { type IpcEvent, type IpcEventPayload, ipcEventSchema } from "@agentic/contracts";
import type { BrowserWindow } from "electron";

/** Sends a validated main → renderer event. */
export function sendEvent<E extends IpcEvent>(
  win: BrowserWindow,
  event: E,
  payload: IpcEventPayload<E>,
): void {
  win.webContents.send(event, ipcEventSchema(event).parse(payload));
}
