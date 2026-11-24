import type { IpcChannel, IpcInput, IpcOutput } from "./channels";
import type { IpcEvent, IpcEventPayload } from "./events";
import type { IpcResult } from "./result";

/** The API the preload script exposes as `window.app`. */
export interface AppBridge {
  invoke<C extends IpcChannel>(channel: C, input: IpcInput<C>): Promise<IpcResult<IpcOutput<C>>>;
  /** Subscribes to a main → renderer event. Returns an unsubscribe function. */
  on<E extends IpcEvent>(event: E, listener: (payload: IpcEventPayload<E>) => void): () => void;
  /** The local path of a dropped file (Electron's `webUtils`), or "" for one without a path. */
  pathForFile(file: File): string;
}
