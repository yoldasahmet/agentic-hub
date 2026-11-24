import { type CoreClient, CoreSocket } from "@agentic/client";
import type { Run, RunStatus } from "@agentic/contracts";
import type { Session } from "./connect";
import { EventPrinter } from "./events";
import { dim, print } from "./output";

const PAGE = 500;
const terminal: RunStatus[] = ["succeeded", "failed", "canceled"];
export const isTerminal = (status: RunStatus) => terminal.includes(status);

/** Exit code for a run's final status: 0 succeeded, 3 waiting at a gate, 1 otherwise. */
export const exitCodeFor = (status: RunStatus) =>
  status === "succeeded" ? 0 : status === "waiting" ? 3 : isTerminal(status) ? 1 : 0;

/** Prints every stored event after `after`; returns the last `seq` seen. */
export async function printStoredEvents(
  client: CoreClient,
  runId: string,
  printer: EventPrinter | undefined,
  after = 0,
): Promise<number> {
  let seq = after;
  for (;;) {
    const page = await client.runs.events(runId, seq);
    for (const event of page.items) printer?.print(event);
    seq = page.lastSeq;
    if (page.items.length < PAGE) return seq;
  }
}

type FollowOptions = { after?: number; stopOnWaiting: boolean; json: boolean };

/**
 * Streams a run's events over the WebSocket (replayed from `after`, then
 * live) until it ends, or until it waits at a gate when `stopOnWaiting`.
 */
export async function followRun(
  { client, connection }: Session,
  runId: string,
  { after = 0, stopOnWaiting, json }: FollowOptions,
): Promise<Run> {
  const printer = new EventPrinter(json);
  const socket = new CoreSocket(connection, {
    onError: (message) => process.stderr.write(`${message}\n`),
  });
  try {
    await new Promise<void>((resolve) => {
      socket.subscribeRun(
        runId,
        (event) => {
          printer.print(event);
          if (event.type !== "run.status") return;
          const { status } = event.payload;
          if (isTerminal(status) || (stopOnWaiting && status === "waiting")) resolve();
        },
        after,
      );
    });
  } finally {
    printer.finish();
    socket.close();
  }
  return client.runs.get(runId);
}

/** After a run stops at a gate: how to answer it from the CLI. */
export function printResumeHint(run: Run): void {
  if (run.status !== "waiting") return;
  print(dim(`Answer the gate in the app's Inbox, or:`));
  print(dim(`  agentic workflows resume ${run.id} --approve | --reject [--data '{…}']`));
}
