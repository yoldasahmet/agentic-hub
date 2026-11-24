import type { Run, RunStatus } from "@agentic/contracts";
import type { EventBus } from "../events/event-bus";

/** A run has stopped for now: finished, or waiting for a human. */
const SETTLED: RunStatus[] = ["waiting", "succeeded", "failed", "canceled"];

/**
 * Resolves when the run settles or the timeout ends, with the latest run.
 * It subscribes before reading, so a change between the two is not missed.
 */
export async function waitForRun(
  bus: EventBus,
  runId: string,
  read: () => Promise<Run>,
  timeoutMs: number,
): Promise<Run> {
  let release = () => {};
  const changed = new Promise<Run>((resolve) => {
    release = bus.subscribe((message) => {
      if (
        message.kind === "run" &&
        message.run.id === runId &&
        SETTLED.includes(message.run.status)
      ) {
        resolve(message.run);
      }
    });
  });
  try {
    const current = await read();
    if (SETTLED.includes(current.status)) return current;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([changed, timeout]);
    clearTimeout(timer);
    return result === "timeout" ? read() : result;
  } finally {
    release();
  }
}
