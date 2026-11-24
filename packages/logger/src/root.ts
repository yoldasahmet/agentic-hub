import { join } from "node:path";
import type { LogLevel } from "@agentic/contracts";
import { type DestinationStream, levels, type Logger as PinoLogger, pino } from "pino";
import { currentLogContext } from "./context";
import { type Logger, lazyLogger } from "./logger";
import { prettyLine } from "./pretty";
import { redactText, redactValue } from "./redact";
import { RotatingFile } from "./rotating-file";

export type LoggingOptions = {
  /** The process name: the file is `<proc>.log` and every line carries `proc`. */
  proc: string;
  level: LogLevel;
  /** Folder for the rotating file; omit to log to the console only. */
  dir?: string;
  /** Also print short lines to stderr from this level up (headless Core, dev). */
  console?: LogLevel | false;
  maxBytes?: number;
  keep?: number;
};

export type LoggingHandle = { file: string | undefined; close(): void };

const levelValue = (level: string) => levels.values[level] ?? 30;

let root: PinoLogger = pino({ level: "silent" });
let generation = 0;
let closeCurrent = () => {};

/** A logger for one module; it follows the process's current configuration. */
export const moduleLogger = (module: string): Logger =>
  lazyLogger(
    () => root.child({ module }),
    () => generation,
  );

/** The process root, for entry points that log before choosing a module. */
export const rootLogger = (): Logger =>
  lazyLogger(
    () => root,
    () => generation,
  );

/**
 * Sets up this process's logging: JSON lines in a rotating file (secrets
 * redacted on the way in), optional terminal output, and the run/trace ids
 * from `withLogContext` on every line. Until called, logging is silent.
 */
export function configureLogging(options: LoggingOptions): LoggingHandle {
  closeCurrent();
  const file = options.dir
    ? new RotatingFile(
        join(options.dir, `${options.proc}.log`),
        options.maxBytes ?? 5_000_000,
        options.keep ?? 4,
      )
    : undefined;
  const consoleMin = options.console ? levelValue(options.console) : Number.POSITIVE_INFINITY;
  const color = process.stderr.isTTY === true;
  const destination: DestinationStream = {
    write(line: string) {
      file?.write(line);
      if (consoleMin !== Number.POSITIVE_INFINITY && levelOf(line) >= consoleMin) {
        process.stderr.write(prettyLine(line, color));
      }
    },
  };
  root = pino(
    {
      level: options.level,
      base: { proc: options.proc, pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
      mixin: () => currentLogContext(),
      formatters: {
        level: (label) => ({ level: label }),
        log: (obj) => redactObject(obj),
      },
      serializers: { err: (err: unknown) => err },
      hooks: {
        logMethod(args, method) {
          const [first, ...rest] = args;
          if (first instanceof Error) {
            const msg = typeof rest[0] === "string" ? rest[0] : first.message;
            return method.apply(this, [{ err: first }, redactText(msg)]);
          }
          const scrubbed = args.map((arg) => (typeof arg === "string" ? redactText(arg) : arg));
          return method.apply(this, scrubbed as Parameters<typeof method>);
        },
      },
    },
    destination,
  );
  generation++;
  closeCurrent = () => file?.close();
  return { file: file?.path, close: () => closeCurrent() };
}

const levelOf = (line: string) => levelValue(/"level":"(\w+)"/.exec(line)?.[1] ?? "info");

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out = redactValue(obj);
  return out !== null && typeof out === "object" && !Array.isArray(out) ? { ...out } : {};
}
