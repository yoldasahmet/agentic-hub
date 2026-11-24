import { AsyncLocalStorage } from "node:async_hooks";

/** Correlation ids every log line inside a scope carries (a request, a run). */
export type LogContext = { runId?: string; threadId?: string; traceId?: string };

const storage = new AsyncLocalStorage<LogContext>();

/**
 * Runs `fn` with these ids added to every log line it causes, across
 * awaits and into libraries (cli-bridge, graph) that know nothing of them.
 */
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run({ ...storage.getStore(), ...context }, fn);
}

export const currentLogContext = (): LogContext => storage.getStore() ?? {};
