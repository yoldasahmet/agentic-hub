import {
  AppError,
  type IpcChannel,
  type IpcContract,
  type IpcOutput,
  type IpcResult,
  ipcContract,
} from "@agentic/contracts";
import { moduleLogger } from "@agentic/logger";
import { ipcMain } from "electron";
import type { z } from "zod";
import { isAppUrl } from "../renderer-url";

const log = moduleLogger("main.ipc");

type HandlerInput<C extends IpcChannel> = z.output<IpcContract<C>["input"]>;
type Handler<C extends IpcChannel> = (
  input: HandlerInput<C>,
) => IpcOutput<C> | Promise<IpcOutput<C>>;

/**
 * Registers one IPC channel. Checks the sender, validates input and output
 * with the contract, and returns errors as data (see `ipcResultSchema`).
 */
export function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  const contract = ipcContract(channel);
  ipcMain.handle(channel, async (event, raw: unknown): Promise<IpcResult<IpcOutput<C>>> => {
    try {
      const senderUrl = event.senderFrame?.url ?? "";
      if (!isAppUrl(senderUrl)) throw new AppError("forbidden", "IPC from an untrusted frame");
      const input = contract.input.parse(raw);
      const data = contract.output.parse(await handler(input));
      return { ok: true, data };
    } catch (err) {
      const error = AppError.from(err);
      // Expected failures (validation, a bad DB URL) are the caller's to show; others get a stack.
      if (error.code === "internal") log.error({ err, channel }, error.message);
      else log.debug({ code: error.code, channel }, error.message);
      return { ok: false, error: error.toJSON() };
    }
  });
}
