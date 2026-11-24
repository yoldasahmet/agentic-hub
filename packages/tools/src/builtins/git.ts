import { gitStatus, runProcess } from "@agentic/cli-bridge";
import { AppError } from "@agentic/contracts";
import { z } from "zod";
import { resolveInside } from "../guardrails/allowlist";
import type { ToolContext } from "../tool";
import { defineTool } from "../tool";

/** Runs git in the working dir; a failing git command is a tool error with its stderr. */
async function git(args: string[], ctx: ToolContext): Promise<string> {
  const out = await runProcess("git", args, {
    cwd: ctx.cwd,
    signal: ctx.signal,
    timeoutMs: ctx.timeoutMs,
    maxOutputBytes: ctx.maxOutputBytes,
    secrets: ctx.secrets,
    extraEnv: { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
  });
  if (out.exitCode !== 0) {
    throw new AppError("tool.failed", `git ${args[0]} failed`, { stderr: out.stderr.trim() });
  }
  return out.truncated ? `${out.stdout}\n…(cut at the output limit)` : out.stdout;
}

export const gitStatusTool = defineTool({
  name: "git.status",
  title: "Git status",
  description: "Branch, ahead/behind, and changed files of the working dir's repo.",
  permission: "read",
  input: z.object({}),
  run: async (_input, ctx) => gitStatus(ctx.cwd),
});

export const gitDiff = defineTool({
  name: "git.diff",
  title: "Git diff",
  description: "The unified diff of unstaged (or staged) changes, optionally for one path.",
  permission: "read",
  input: z.object({ staged: z.boolean().default(false), path: z.string().optional() }),
  async run({ staged, path }, ctx) {
    const args = ["diff", "--no-color", "--no-ext-diff"];
    if (staged) args.push("--cached");
    if (path) args.push("--", await resolveInside(ctx.cwd, path));
    return { diff: await git(args, ctx) };
  },
});

export const gitLog = defineTool({
  name: "git.log",
  title: "Git log",
  description: "Recent commits: hash, author, date, and subject.",
  permission: "read",
  input: z.object({ limit: z.number().int().min(1).max(200).default(20) }),
  async run({ limit }, ctx) {
    const text = await git(["log", `-n${limit}`, "--pretty=format:%h%x09%an%x09%aI%x09%s"], ctx);
    const commits = text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, ...subject] = line.split("\t");
        return { hash, author, date, subject: subject.join("\t") };
      });
    return { commits };
  },
});

export const gitCommit = defineTool({
  name: "git.commit",
  title: "Git commit",
  description: "Stage the given paths (or all changes) and commit them with a message.",
  permission: "write",
  input: z.object({
    message: z.string().trim().min(1).max(10_000),
    paths: z.array(z.string().min(1)).max(500).optional(),
  }),
  async run({ message, paths }, ctx) {
    const targets = paths?.length
      ? await Promise.all(paths.map((p) => resolveInside(ctx.cwd, p)))
      : ["-A"];
    await git(["add", ...(paths?.length ? ["--", ...targets] : targets)], ctx);
    await git(["commit", "-m", message], ctx);
    return { commit: (await git(["rev-parse", "--short", "HEAD"], ctx)).trim() };
  },
});
