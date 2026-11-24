import { spawn } from "node:child_process";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { moduleLogger } from "@agentic/logger";
import { redact, TailBuffer } from "./redact";

const log = moduleLogger("cli-bridge");

export type SpawnCliOptions = {
  /** An absolute path from `resolveCommand`. Never run through a shell. */
  command: string;
  args: readonly string[];
  /** Already checked by `validateWorkingDir`. */
  cwd: string;
  env: Record<string, string>;
  stdin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CliExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
  reason: "exit" | "cancelled" | "timeout" | "spawn_failed";
  /** The tail of stderr, unredacted: callers redact before surfacing it. */
  stderr: string;
  spawnError?: string;
};

export type CliProcess = {
  pid: number | undefined;
  /** stdout split into lines. Ends when the process closes stdout. */
  lines: AsyncIterable<string>;
  exited: Promise<CliExit>;
  kill(): void;
};

const KILL_GRACE_MS = 3_000;

/**
 * Spawns one CLI in its own process group so cancel and timeout stop the
 * tools it started too: SIGTERM to the group, then SIGKILL after a grace
 * period. No shell is involved, so arguments are never interpreted.
 */
export function spawnCli(options: SpawnCliOptions): CliProcess {
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  const stderr = new TailBuffer();
  const started = Date.now();
  const cli = basename(options.command);
  // Arguments carry prompts, so only the command, folder, and pid are logged.
  log.debug({ cli, cwd: options.cwd, pid: child.pid }, "cli spawned");
  let reason: CliExit["reason"] = "exit";
  let spawnError: string | undefined;

  const signalGroup = (sig: NodeJS.Signals) => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(process.platform === "win32" ? child.pid : -child.pid, sig);
    } catch {
      child.kill(sig);
    }
  };
  const stop = (why: CliExit["reason"]) => {
    if (reason === "exit") reason = why;
    signalGroup("SIGTERM");
    setTimeout(() => signalGroup("SIGKILL"), KILL_GRACE_MS).unref();
  };

  const onAbort = () => stop("cancelled");
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = options.timeoutMs
    ? setTimeout(() => stop("timeout"), options.timeoutMs)
    : undefined;

  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => stderr.push(chunk));
  if (options.stdin !== undefined && child.stdin) {
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.stdin);
  }

  const exited = new Promise<CliExit>((resolve) => {
    const finish = (code: number | null, sig: NodeJS.Signals | null) => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      const exit = { code, signal: sig, reason, stderr: stderr.toString(), spawnError };
      logExit(cli, exit, Date.now() - started);
      resolve(exit);
    };
    child.once("error", (err) => {
      spawnError = err.message;
      reason = "spawn_failed";
      if (child.pid === undefined) finish(null, null);
    });
    child.once("close", finish);
  });

  if (options.signal?.aborted) onAbort();
  const lines = child.stdout
    ? createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY })
    : emptyLines();
  return { pid: child.pid, lines, exited, kill: () => stop("cancelled") };
}

function logExit(cli: string, exit: CliExit, durationMs: number): void {
  const fields = { cli, code: exit.code, signal: exit.signal, reason: exit.reason, durationMs };
  if (exit.reason === "exit" && exit.code === 0) {
    log.debug(fields, "cli exited");
  } else if (exit.reason === "cancelled") {
    log.info(fields, "cli cancelled");
  } else {
    const stderrTail = redact(exit.stderr).trim().slice(-2_000);
    log.warn({ ...fields, spawnError: exit.spawnError, stderrTail }, "cli failed");
  }
}

async function* emptyLines(): AsyncIterable<string> {}
