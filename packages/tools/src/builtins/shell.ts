import { runProcess } from "@agentic/cli-bridge";
import { z } from "zod";
import { defineTool } from "../tool";

/**
 * A shell line in the working dir. `dangerous`: it can do anything the
 * user can, so the default policy asks first. The env is the same filtered
 * env CLIs get, so the app's own config and unrelated tokens stay out.
 */
export const shellRun = defineTool({
  name: "shell.run",
  title: "Run shell command",
  description: "Run a command with /bin/sh in the working dir and return its exit code and output.",
  permission: "dangerous",
  input: z.object({
    command: z.string().trim().min(1).max(10_000),
    stdin: z.string().max(1_000_000).optional(),
  }),
  async run({ command, stdin }, ctx) {
    const out = await runProcess("/bin/sh", ["-c", command], {
      cwd: ctx.cwd,
      signal: ctx.signal,
      timeoutMs: ctx.timeoutMs,
      maxOutputBytes: ctx.maxOutputBytes,
      secrets: ctx.secrets,
      stdin,
    });
    return {
      exitCode: out.exitCode,
      stdout: out.stdout,
      stderr: out.stderr,
      truncated: out.truncated,
      timedOut: out.reason === "timeout",
    };
  },
});
