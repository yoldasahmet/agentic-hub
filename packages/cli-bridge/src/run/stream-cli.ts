import {
  AppError,
  DEFAULT_LLM_TIMEOUT_MS,
  type LlmEvent,
  type LlmRequest,
} from "@agentic/contracts";
import { buildChildEnv } from "../process/child-env";
import { redact } from "../process/redact";
import { resolveCommand, searchPath } from "../process/search-path";
import { type CliExit, spawnCli } from "../process/spawn-cli";
import { validateWorkingDir } from "../process/working-dir";
import type { CliExtras, CliSpec } from "../specs/cli-spec";

export type StreamCliOptions = {
  signal?: AbortSignal;
  /** The environment to filter for the child; defaults to this process's. */
  env?: NodeJS.ProcessEnv;
  /** Values to mask in anything surfaced from the CLI's stderr. */
  secrets?: readonly string[];
  extras?: CliExtras;
};

/**
 * Runs one request through a CLI and yields normalized events. It never
 * throws for runtime failures (not installed, bad cwd, non-zero exit,
 * cancel, timeout): those become an `error` event. `done` is always last.
 * Breaking out of the loop early stops the process group.
 */
export async function* streamCli(
  spec: CliSpec,
  req: LlmRequest,
  { signal, env = process.env, secrets = [], extras }: StreamCliOptions = {},
): AsyncGenerator<LlmEvent> {
  const path = await searchPath();
  const command = await resolveCommand(spec.command, path);
  if (!command) {
    yield {
      type: "error",
      code: "cli.not_installed",
      message: `${spec.name} (\`${spec.command}\`) is not installed`,
    };
    yield { type: "done", stopReason: "error" };
    return;
  }
  let cwd: string;
  try {
    cwd = await validateWorkingDir(req.cwd);
  } catch (err) {
    const error = AppError.from(err);
    yield { type: "error", code: error.code, message: error.message };
    yield { type: "done", stopReason: "error" };
    return;
  }

  const invocation = await spec.invoke(req, extras);
  const parser = spec.createParser();
  const proc = spawnCli({
    command,
    args: invocation.args,
    cwd,
    env: buildChildEnv(env, { passPrefixes: spec.passEnv, path, extra: invocation.env }),
    stdin: invocation.stdin,
    signal,
    timeoutMs: req.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS,
  });
  let stopReason: string | undefined;
  let reportedError = false;
  let finished = false;
  try {
    for await (const line of proc.lines) {
      for (const event of parser.push(line)) {
        if (event.type === "done") {
          stopReason = event.stopReason;
          continue;
        }
        if (event.type === "error") reportedError = true;
        yield event;
      }
    }
    const exit = await proc.exited;
    finished = true;
    const masked = [
      ...secrets,
      ...(extras?.mcp?.servers.flatMap((m) => Object.values(m.secrets)) ?? []),
    ];
    const failure = exitError(spec, exit, reportedError, masked);
    if (failure) yield failure;
    yield { type: "done", stopReason: exit.reason === "exit" ? stopReason : exit.reason };
  } finally {
    if (!finished) proc.kill();
    await invocation.cleanup?.().catch(() => undefined);
  }
}

function exitError(
  spec: CliSpec,
  exit: CliExit,
  reportedError: boolean,
  secrets: readonly string[],
): LlmEvent | undefined {
  if (exit.reason === "cancelled")
    return { type: "error", code: "cli.cancelled", message: "Cancelled" };
  if (exit.reason === "timeout")
    return { type: "error", code: "cli.timeout", message: `${spec.name} timed out` };
  if (exit.reason === "spawn_failed") {
    return {
      type: "error",
      code: "cli.spawn_failed",
      message: `Could not start ${spec.name}: ${exit.spawnError}`,
    };
  }
  if (exit.code === 0 || reportedError) return undefined;
  const tail = redact(exit.stderr, secrets).trim().split("\n").slice(-6).join("\n");
  return {
    type: "error",
    code: "cli.exit",
    message: `${spec.name} exited with code ${exit.code ?? exit.signal}${tail ? `: ${tail}` : ""}`,
  };
}
