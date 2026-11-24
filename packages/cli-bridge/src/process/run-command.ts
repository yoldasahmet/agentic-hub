import { execFile } from "node:child_process";

export type CommandOutput = { code: number | null; stdout: string; stderr: string };

/** A short, non-streaming run for detection (`--version`, auth status). */
export function runCommand(
  command: string,
  args: readonly string[],
  options: { env: Record<string, string>; cwd?: string; timeoutMs?: number },
): Promise<CommandOutput> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env: options.env,
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 10_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === "number" ? err.code : null) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}
