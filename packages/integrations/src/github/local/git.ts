import { runProcess } from "@agentic/cli-bridge";
import { AppError } from "@agentic/contracts";

export type GitAuth = { token: string; host: string };
export type GitOptions = { cwd: string; auth?: GitAuth; signal?: AbortSignal; timeoutMs?: number };

/**
 * Git config through the environment (GIT_CONFIG_COUNT), so the token goes
 * neither into argv nor into `.git/config` of a clone.
 */
export function authEnv(auth: GitAuth | undefined): Record<string, string> {
  if (!auth) return {};
  const basic = Buffer.from(`x-access-token:${auth.token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.https://${auth.host}/.extraheader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}

/** Runs git without prompts; a failure is an AppError carrying git's stderr. */
export async function git(args: string[], options: GitOptions): Promise<string> {
  const secrets = options.auth ? [options.auth.token] : [];
  const out = await runProcess("git", args, {
    cwd: options.cwd,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 120_000,
    maxOutputBytes: 1_000_000,
    secrets,
    extraEnv: { GIT_TERMINAL_PROMPT: "0", ...authEnv(options.auth) },
  });
  if (out.exitCode !== 0) {
    throw new AppError("git.failed", `git ${args[0]} failed`, { stderr: out.stderr.trim() });
  }
  return out.stdout;
}

/** `owner/name` of an https or ssh GitHub remote URL, or undefined for other hosts. */
export function parseRemote(url: string, host = "github.com"): string | undefined {
  const escaped = host.replaceAll(".", "\\.");
  const match = new RegExp(`${escaped}[/:]([^/]+)/([^/]+?)(?:\\.git)?/?$`).exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export async function originRepo(cwd: string, host?: string): Promise<string> {
  const url = (await git(["remote", "get-url", "origin"], { cwd })).trim();
  const repo = parseRemote(url, host);
  if (!repo) throw new AppError("validation_failed", `origin is not a GitHub repo: ${url}`);
  return repo;
}

export async function currentBranch(cwd: string): Promise<string> {
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })).trim();
  if (branch === "HEAD")
    throw new AppError("validation_failed", "HEAD is detached; check out a branch");
  return branch;
}
