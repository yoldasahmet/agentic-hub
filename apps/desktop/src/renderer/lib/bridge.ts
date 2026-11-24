import {
  AppError,
  type IpcChannel,
  type IpcEvent,
  type IpcEventPayload,
  type IpcInput,
  type IpcOutput,
  ipcContract,
  ipcResultSchema,
} from "@agentic/contracts";

/** Calls main over the preload bridge. Validates the reply and throws `AppError` on failure. */
export async function invoke<C extends IpcChannel>(
  channel: C,
  input: IpcInput<C>,
): Promise<IpcOutput<C>> {
  const raw: unknown = await window.app.invoke(channel, input);
  const result = ipcResultSchema(ipcContract(channel).output).parse(raw);
  if (!result.ok) throw new AppError(result.error.code, result.error.message, result.error.details);
  return result.data;
}

export function onEvent<E extends IpcEvent>(
  event: E,
  listener: (payload: IpcEventPayload<E>) => void,
): () => void {
  return window.app.on(event, listener);
}
