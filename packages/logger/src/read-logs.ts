import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type LogEntry,
  type LogLevel,
  type LogQuery,
  type LogQueryResult,
  logLevelSchema,
  logLevels,
  logQuerySchema,
} from "@agentic/contracts";
import { z } from "zod";

/** How much of each process's newest files one query scans. */
const SCAN_BYTES_PER_PROC = 4_000_000;
const LOG_FILE = /^([a-z][a-z0-9-]*)(?:\.(\d+))?\.log$/;

const lineSchema = z.looseObject({
  time: z.string(),
  level: logLevelSchema,
  proc: z.string(),
  msg: z.string().catch(""),
  module: z.string().optional(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  traceId: z.string().optional(),
});

/** Reads the newest lines of every `<proc>.log` (and its rotations) in `dir`, newest first. */
export async function readLogs(dir: string, input: LogQuery = {}): Promise<LogQueryResult> {
  const query = logQuerySchema.parse(input);
  const entries: LogEntry[] = [];
  const modules = new Set<string>();
  for (const files of await filesByProc(dir)) {
    let budget = SCAN_BYTES_PER_PROC;
    for (const file of files) {
      if (budget <= 0) break;
      const { text, read } = await readTail(join(dir, file), budget);
      budget -= read;
      for (const entry of parseLines(text)) {
        if (entry.module) modules.add(entry.module);
        if (matches(entry, query)) entries.push(entry);
      }
    }
  }
  entries.sort((a, b) => b.time.localeCompare(a.time));
  return { entries: entries.slice(0, query.limit), modules: [...modules].sort(), dir };
}

/** Files grouped per process, newest first (`core.log`, `core.1.log`, …). */
async function filesByProc(dir: string): Promise<string[][]> {
  const names = await readdir(dir).catch(() => []);
  const groups = new Map<string, Array<{ name: string; n: number }>>();
  for (const name of names) {
    const match = LOG_FILE.exec(name);
    if (!match?.[1]) continue;
    const group = groups.get(match[1]) ?? [];
    group.push({ name, n: Number(match[2] ?? 0) });
    groups.set(match[1], group);
  }
  return [...groups.values()].map((g) => g.sort((a, b) => a.n - b.n).map((f) => f.name));
}

async function readTail(path: string, budget: number): Promise<{ text: string; read: number }> {
  const handle = await open(path, "r").catch(() => undefined);
  if (!handle) return { text: "", read: 0 };
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, budget);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    // A partial first line is cut off when the read starts mid-file.
    return { text: length < size ? text.slice(text.indexOf("\n") + 1) : text, read: length };
  } finally {
    await handle.close();
  }
}

function* parseLines(text: string): Generator<LogEntry> {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = lineSchema.safeParse(raw);
    if (!parsed.success) continue;
    const { time, level, proc, msg, module, runId, threadId, traceId, ...data } = parsed.data;
    yield { time, level, proc, msg, module, runId, threadId, traceId, data };
  }
}

const rank = (level: LogLevel) => logLevels.indexOf(level);

function matches(entry: LogEntry, query: z.output<typeof logQuerySchema>): boolean {
  if (rank(entry.level) < rank(query.level)) return false;
  if (query.module && entry.module !== query.module) return false;
  if (query.runId && entry.runId !== query.runId) return false;
  if (query.traceId && entry.traceId !== query.traceId) return false;
  if (query.search) {
    const needle = query.search.toLowerCase();
    const hay = `${entry.msg} ${JSON.stringify(entry.data)}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}
