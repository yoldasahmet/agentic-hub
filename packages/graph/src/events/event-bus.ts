import type { Run, RunEvent } from "@agentic/contracts";

export type BusMessage =
  | { kind: "event"; workspaceId: string; event: RunEvent }
  | { kind: "run"; workspaceId: string; run: Run };

/**
 * Fan-out of persisted events to live listeners (WS, waiters). In memory
 * today; a Postgres LISTEN/NOTIFY adapter can implement the same interface
 * when live views must cross app instances (Backlog).
 */
export interface EventBus {
  publish(message: BusMessage): void;
  subscribe(listener: (message: BusMessage) => void): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Set<(message: BusMessage) => void>();

  publish(message: BusMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch {
        // One broken subscriber must not stop delivery to the others.
      }
    }
  }

  subscribe(listener: (message: BusMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
