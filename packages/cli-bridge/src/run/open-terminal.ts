import { AppError } from "@agentic/contracts";
import { buildChildEnv } from "../process/child-env";
import { resolveCommand, searchPath } from "../process/search-path";
import { validateWorkingDir } from "../process/working-dir";
import { openPty, type PtySession } from "../pty/pty-session";
import type { CliExtras, CliSpec } from "../specs/cli-spec";

export type TerminalOptions = { cwd: string; cols: number; rows: number; extras?: CliExtras };

/**
 * Starts a CLI's own interactive session in a PTY (chat terminal mode):
 * the same command lookup, env allowlist, and cwd check as headless runs.
 * MCP servers and skills become the CLI's own session flags; a temp
 * config file is removed when the session ends.
 */
export async function openCliTerminal(
  spec: CliSpec,
  { cwd, cols, rows, extras }: TerminalOptions,
): Promise<{ session: PtySession; command: string; cwd: string }> {
  const dir = await validateWorkingDir(cwd);
  const path = await searchPath();
  const command = await resolveCommand(spec.command, path);
  if (!command) {
    throw new AppError("cli.not_found", `\`${spec.command}\` was not found on PATH`);
  }
  const env = buildChildEnv(process.env, {
    passPrefixes: spec.passEnv,
    path,
    extra: { TERM: "xterm-256color", COLORTERM: "truecolor" },
  });
  const invocation = extras && spec.sessionArgs ? await spec.sessionArgs(extras) : { args: [] };
  const session = await openPty({
    command,
    args: invocation.args,
    cwd: dir,
    env: { ...env, ...invocation.env },
    cols,
    rows,
  }).catch(async (err: unknown) => {
    await invocation.cleanup?.();
    throw err;
  });
  if (invocation.cleanup) void session.exited.then(() => invocation.cleanup?.());
  return { session, command, cwd: dir };
}
