import type { McpServerLaunch, ToolDescriptor } from "@agentic/contracts";
import { connectMcp, type McpConnection } from "./connect";

const IDLE_MS = 5 * 60_000;

type Entry = {
  key: string;
  connection: Promise<McpConnection>;
  tools?: ToolDescriptor[];
  timer?: NodeJS.Timeout;
};

/**
 * Keeps one live connection per server and reuses it across calls, since
 * starting a stdio server per call is slow. A config change (new key)
 * reconnects; idle connections close after five minutes.
 */
export class McpPool {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly version: string) {}

  async tools(id: string, launch: McpServerLaunch): Promise<ToolDescriptor[]> {
    const entry = this.entry(id, launch);
    entry.tools ??= await (await entry.connection).listTools();
    return entry.tools;
  }

  async call(
    id: string,
    launch: McpServerLaunch,
    tool: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    const connection = await this.entry(id, launch).connection;
    return connection.call(tool, input, signal);
  }

  /** Connects fresh (outside the pool) and lists the tools: the Settings "Test" button. */
  async test(launch: McpServerLaunch): Promise<ToolDescriptor[]> {
    const connection = await connectMcp(launch, this.version);
    try {
      return await connection.listTools();
    } finally {
      await connection.close().catch(() => undefined);
    }
  }

  async drop(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    clearTimeout(entry.timer);
    await (await entry.connection.catch(() => undefined))?.close().catch(() => undefined);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((id) => this.drop(id)));
  }

  private entry(id: string, launch: McpServerLaunch): Entry {
    const key = JSON.stringify(launch);
    let entry = this.entries.get(id);
    if (entry && entry.key !== key) {
      void this.drop(id);
      entry = undefined;
    }
    if (!entry) {
      const connection = connectMcp(launch, this.version);
      entry = { key, connection };
      this.entries.set(id, entry);
      // A failed connect is not cached, so the next call retries.
      connection.catch(() => {
        if (this.entries.get(id)?.connection === connection) this.entries.delete(id);
      });
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void this.drop(id), IDLE_MS);
    entry.timer.unref();
    return entry;
  }
}
