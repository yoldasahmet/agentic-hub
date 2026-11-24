import {
  AppError,
  type WsClientMessage,
  type WsServerMessage,
  wsClientMessageSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import type { WebSocket } from "ws";
import type { TerminalService } from "../modules/terminals/service";
import { RunSubscription } from "./run-subscription";
import { isTerminalMessage, terminalChannel } from "./terminal-channel";

/** One client socket: run subscriptions with replay, the workspace run feed, and terminals. */
export function serveConnection(
  socket: WebSocket,
  graph: GraphRuntime,
  terminals: TerminalService,
  ctx: LocalContext,
): void {
  const subscriptions = new Map<string, RunSubscription>();
  let watchingRuns = false;

  const send = (message: WsServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const fail = (err: unknown) => send({ type: "error", error: AppError.from(err).toJSON() });
  const terminal = terminalChannel(terminals, ctx, send);

  const unsubscribeBus = graph.bus.subscribe((message) => {
    if (message.workspaceId !== ctx.workspaceId) return;
    if (message.kind === "event") subscriptions.get(message.event.runId)?.push(message.event);
    else if (watchingRuns) send({ type: "run", run: message.run });
  });

  const handle = async (message: WsClientMessage) => {
    if (isTerminalMessage(message)) {
      terminal.handle(message);
    } else if (message.type === "watch-runs") {
      watchingRuns = true;
    } else if (message.type === "unsubscribe") {
      subscriptions.get(message.runId)?.close();
      subscriptions.delete(message.runId);
    } else {
      subscriptions.get(message.runId)?.close();
      const subscription = new RunSubscription(message.after, (event) =>
        send({ type: "event", event }),
      );
      subscriptions.set(message.runId, subscription);
      await subscription.replay((after, limit) =>
        graph.runs.events(ctx, message.runId, after, limit),
      );
    }
  };

  socket.on("message", (data) => {
    try {
      const message = wsClientMessageSchema.parse(JSON.parse(data.toString()));
      handle(message).catch(fail);
    } catch (err) {
      fail(err);
    }
  });
  socket.on("close", () => {
    unsubscribeBus();
    terminal.close();
    for (const subscription of subscriptions.values()) subscription.close();
    subscriptions.clear();
  });
}
