import {
  type Run,
  type RunEvent,
  type WsClientMessage,
  type WsServerMessage,
  wsServerMessageSchema,
} from "@agentic/contracts";
import type { CoreConnection } from "./http-client";

type RunListener = (event: RunEvent) => void;
type TerminalListener = {
  data(chunk: string): void;
  exit(code: number): void;
  /** Called before a reconnect re-attaches; the scrollback then arrives again. */
  reattach?(): void;
};
type Options = { minDelayMs?: number; maxDelayMs?: number; onError?: (message: string) => void };

/**
 * One WebSocket to Core with automatic reconnect (exponential backoff).
 * Each run subscription remembers the last `seq` it saw; after a
 * reconnect it re-subscribes from there, so no event is lost or repeated.
 */
export class CoreSocket {
  private socket: WebSocket | undefined;
  private readonly runs = new Map<string, { lastSeq: number; listeners: Set<RunListener> }>();
  private readonly runWatchers = new Set<(run: Run) => void>();
  private readonly terminals = new Map<string, TerminalListener>();
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly connection: CoreConnection,
    private readonly options: Options = {},
  ) {
    this.connect();
  }

  /** Streams a run's events after `after` (0 = from the start), then live ones. */
  subscribeRun(runId: string, listener: RunListener, after = 0): () => void {
    const entry = this.runs.get(runId) ?? { lastSeq: after, listeners: new Set<RunListener>() };
    entry.listeners.add(listener);
    if (!this.runs.has(runId)) {
      this.runs.set(runId, entry);
      this.send({ type: "subscribe", runId, after: entry.lastSeq });
    }
    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size > 0) return;
      this.runs.delete(runId);
      this.send({ type: "unsubscribe", runId });
    };
  }

  /** Every run status change in the workspace (lists, Inbox). */
  watchRuns(listener: (run: Run) => void): () => void {
    this.runWatchers.add(listener);
    if (this.runWatchers.size === 1) this.send({ type: "watch-runs" });
    return () => this.runWatchers.delete(listener);
  }

  /**
   * Streams a terminal's output (its recent scrollback first). After a
   * reconnect it re-attaches: `reattach` lets the listener clear its screen
   * before the scrollback arrives again.
   */
  attachTerminal(terminalId: string, listener: TerminalListener): () => void {
    this.terminals.set(terminalId, listener);
    this.send({ type: "terminal.attach", terminalId });
    return () => {
      if (this.terminals.get(terminalId) !== listener) return;
      this.terminals.delete(terminalId);
      this.send({ type: "terminal.detach", terminalId });
    };
  }

  writeTerminal(terminalId: string, data: string): void {
    this.send({ type: "terminal.input", terminalId, data });
  }

  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    this.send({ type: "terminal.resize", terminalId, cols, rows });
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.socket?.close();
  }

  private connect(): void {
    const url = new URL("/ws", this.connection.url.replace(/^http/, "ws"));
    url.searchParams.set("token", this.connection.token);
    if (this.connection.session) url.searchParams.set("session", this.connection.session);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      for (const [runId, { lastSeq }] of this.runs)
        this.send({ type: "subscribe", runId, after: lastSeq });
      if (this.runWatchers.size > 0) this.send({ type: "watch-runs" });
      for (const [terminalId, listener] of this.terminals) {
        listener.reattach?.();
        this.send({ type: "terminal.attach", terminalId });
      }
    };
    socket.onmessage = (message) => this.receive(message.data);
    socket.onclose = () => this.scheduleReconnect();
  }

  private receive(data: unknown): void {
    let message: WsServerMessage;
    try {
      message = wsServerMessageSchema.parse(JSON.parse(String(data)));
    } catch {
      return;
    }
    if (message.type === "error") this.options.onError?.(message.error.message);
    else if (message.type === "run") for (const watcher of this.runWatchers) watcher(message.run);
    else if (message.type === "terminal.data")
      this.terminals.get(message.terminalId)?.data(message.data);
    else if (message.type === "terminal.exit")
      this.terminals.get(message.terminalId)?.exit(message.code);
    else {
      const entry = this.runs.get(message.event.runId);
      if (!entry || message.event.seq <= entry.lastSeq) return;
      entry.lastSeq = message.event.seq;
      for (const listener of entry.listeners) listener(message.event);
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const { minDelayMs = 250, maxDelayMs = 10_000 } = this.options;
    const delay = Math.min(minDelayMs * 2 ** this.attempt, maxDelayMs);
    this.attempt += 1;
    this.timer = setTimeout(() => this.connect(), delay);
  }

  private send(message: WsClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
