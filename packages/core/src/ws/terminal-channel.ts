import type { WsClientMessage, WsServerMessage } from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { TerminalService } from "../modules/terminals/service";

type TerminalMessage = Extract<WsClientMessage, { type: `terminal.${string}` }>;

/** One socket's terminal attachments: output out, keystrokes and resizes in. */
export function terminalChannel(
  terminals: TerminalService,
  ctx: LocalContext,
  send: (message: WsServerMessage) => void,
) {
  const attached = new Map<string, () => void>();
  return {
    handle(message: TerminalMessage): void {
      const { terminalId } = message;
      switch (message.type) {
        case "terminal.attach":
          attached.get(terminalId)?.();
          attached.set(
            terminalId,
            terminals.attach(ctx, terminalId, {
              data: (data) => send({ type: "terminal.data", terminalId, data }),
              exit: (code) => send({ type: "terminal.exit", terminalId, code }),
            }),
          );
          return;
        case "terminal.detach":
          attached.get(terminalId)?.();
          attached.delete(terminalId);
          return;
        case "terminal.input":
          terminals.write(ctx, terminalId, message.data);
          return;
        case "terminal.resize":
          terminals.resize(ctx, terminalId, message.cols, message.rows);
          return;
      }
    },
    close(): void {
      for (const detach of attached.values()) detach();
      attached.clear();
    },
  };
}

export const isTerminalMessage = (message: WsClientMessage): message is TerminalMessage =>
  message.type.startsWith("terminal.");
