import type { RunEvent } from "@agentic/contracts";

const PAGE = 500;

/**
 * Replays a run's persisted events after a cursor, then switches to live
 * ones. Live events that arrive during the replay are buffered and
 * de-duplicated by `seq`, so a client sees every event exactly once.
 */
export class RunSubscription {
  private buffer: RunEvent[] | undefined = [];
  private lastSeq: number;
  private closed = false;

  constructor(
    after: number,
    private readonly send: (event: RunEvent) => void,
  ) {
    this.lastSeq = after;
  }

  push(event: RunEvent): void {
    if (this.buffer) this.buffer.push(event);
    else this.deliver(event);
  }

  async replay(load: (after: number, limit: number) => Promise<RunEvent[]>): Promise<void> {
    for (;;) {
      const page = await load(this.lastSeq, PAGE);
      for (const event of page) this.deliver(event);
      if (page.length < PAGE || this.closed) break;
    }
    const buffered = (this.buffer ?? []).sort((a, b) => a.seq - b.seq);
    this.buffer = undefined;
    for (const event of buffered) this.deliver(event);
  }

  close(): void {
    this.closed = true;
  }

  private deliver(event: RunEvent): void {
    if (this.closed || event.seq <= this.lastSeq) return;
    this.lastSeq = event.seq;
    this.send(event);
  }
}
