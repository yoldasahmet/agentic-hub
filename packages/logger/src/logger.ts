import type { LogLevel } from "@agentic/contracts";
import type { Logger as PinoLogger } from "pino";

type LogFn = {
  (msg: string): void;
  (obj: object, msg?: string): void;
};

/** The logger every package uses. Fields go first, the message last (pino style). */
export type Logger = Record<LogLevel, LogFn> & {
  child(bindings: Record<string, unknown>): Logger;
  isLevelEnabled(level: LogLevel): boolean;
};

const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

/**
 * A logger that resolves its pino instance on use, and again after the
 * process reconfigures logging. Module-level loggers can therefore be
 * created at import time, before the entry point calls `configureLogging`.
 */
export function lazyLogger(resolve: () => PinoLogger, generation: () => number): Logger {
  let cached: { gen: number; logger: PinoLogger } | undefined;
  const get = () => {
    const gen = generation();
    if (cached?.gen !== gen) cached = { gen, logger: resolve() };
    return cached.logger;
  };
  const at =
    (level: LogLevel): LogFn =>
    (first: object | string, msg?: string) => {
      const logger = get();
      if (typeof first === "string") logger[level](first);
      else logger[level](first, msg);
    };
  const out = Object.fromEntries(levels.map((level) => [level, at(level)])) as Record<
    LogLevel,
    LogFn
  >;
  return {
    ...out,
    child: (bindings) => lazyLogger(() => get().child(bindings), generation),
    isLevelEnabled: (level) => get().isLevelEnabled(level),
  };
}
