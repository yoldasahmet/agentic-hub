import { AppError } from "@agentic/contracts";
import { buildChildEnv } from "../process/child-env";
import { redact } from "../process/redact";
import { resolveCommand, searchPath } from "../process/search-path";
import { spawnCli } from "../process/spawn-cli";
import { validateWorkingDir } from "../process/working-dir";

export type RunProcessOptions = {
  /** Checked again here; callers check it against the tool allowlist first. */
  cwd: string;
  signal?: AbortSignal;
  timeoutMs: number;
  /** stdout beyond this is dropped and `truncated` is set. */
  maxOutputBytes: number;
  stdin?: string;
  /** Values to mask in the output. */
  secrets?: readonly string[];
  extraEnv?: Record<string, string>;
};

export type ProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  reason: "exit" | "cancelled" | "timeout";
};

/**
 * Runs one command for a tool (git, a shell line) and collects its output
 * within a budget. Same process rules as CLIs: PATH lookup without a
 * shell, the filtered env, its own process group, cancel and timeout.
 */
export async function runProcess(
  command: string,
  args: readonly string[],
  options: RunProcessOptions,
): Promise<ProcessResult> {
  const path = await searchPath();
  const resolved = await resolveCommand(command, path);
  if (!resolved) throw new AppError("cli.not_found", `\`${command}\` was not found on PATH`);
  const cwd = await validateWorkingDir(options.cwd);
  const proc = spawnCli({
    command: resolved,
    args,
    cwd,
    env: buildChildEnv(process.env, { path, extra: options.extraEnv }),
    stdin: options.stdin,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
  let stdout = "";
  let truncated = false;
  for await (const line of proc.lines) {
    if (truncated) continue;
    if (stdout.length + line.length + 1 > options.maxOutputBytes) {
      stdout += line.slice(0, Math.max(0, options.maxOutputBytes - stdout.length));
      truncated = true;
      continue;
    }
    stdout += `${line}\n`;
  }
  const exit = await proc.exited;
  if (exit.reason === "spawn_failed") {
    throw new AppError("cli.spawn_failed", exit.spawnError ?? `Could not start ${command}`);
  }
  const secrets = options.secrets ?? [];
  return {
    exitCode: exit.code,
    stdout: redact(stdout, secrets),
    stderr: redact(exit.stderr.slice(-8_000), secrets),
    truncated,
    reason: exit.reason,
  };
}
