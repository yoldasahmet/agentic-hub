import {
  type AppBridge,
  type IpcChannel,
  type IpcEvent,
  type IpcEventPayload,
  ipcChannelNames,
  ipcEventNames,
  ipcEventSchema,
} from "@agentic/contracts";
import { contextBridge, ipcRenderer, webUtils } from "electron";

const channels = new Set<string>(ipcChannelNames);
const events = new Set<string>(ipcEventNames);

/**
 * `window.app`: the renderer's only route to native code. It allows the
 * contract's channels only; main validates every payload.
 */
const bridge: AppBridge = {
  invoke(channel: IpcChannel, input: unknown) {
    if (!channels.has(channel)) return Promise.reject(new Error(`Unknown channel: ${channel}`));
    return ipcRenderer.invoke(channel, input);
  },
  on<E extends IpcEvent>(event: E, listener: (payload: IpcEventPayload<E>) => void) {
    if (!events.has(event)) throw new Error(`Unknown event: ${event}`);
    const schema = ipcEventSchema(event);
    const wrapped = (_e: Electron.IpcRendererEvent, payload: unknown) => {
      const parsed = schema.safeParse(payload);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
  pathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("app", bridge);
