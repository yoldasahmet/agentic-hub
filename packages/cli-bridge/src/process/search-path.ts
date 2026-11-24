import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

const MARK = "__AGENTIC_PATH__";

/** Where the four CLIs usually land; GUI apps on macOS don't inherit these. */
const commonDirs = () => {
  const home = homedir();
  return [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(home, ".local/bin"),
    join(home, ".npm-global/bin"),
    join(home, ".bun/bin"),
    join(home, ".opencode/bin"),
    join(home, ".volta/bin"),
  ];
};

function loginShellPath(): Promise<string | undefined> {
  const shell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/sh");
  return new Promise((resolve) => {
    execFile(
      shell,
      ["-ilc", `printf '${MARK}%s${MARK}' "$PATH"`],
      { timeout: 5_000, env: { HOME: homedir(), USER: process.env.USER ?? "" } },
      (err, stdout) => {
        const match = err ? null : new RegExp(`${MARK}(.*)${MARK}`).exec(stdout);
        resolve(match?.[1] || undefined);
      },
    );
  });
}

let cached: Promise<string> | undefined;

/**
 * Honor the launching process PATH first. A Finder launch often gets only
 * /usr/bin:/bin, so also search the login shell and usual install dirs. Resolved once per process.
 */
export function searchPath(): Promise<string> {
  cached ??= (async () => {
    const shell = process.platform === "darwin" ? await loginShellPath() : undefined;
    const parts = [process.env.PATH, shell, ...commonDirs()]
      .flatMap((p) => (p ? p.split(delimiter) : []))
      .filter((p) => p && isAbsolute(p));
    return [...new Set(parts)].join(delimiter);
  })();
  return cached;
}

/** Finds an executable by name on `path`, like `which`, without spawning a shell. */
export async function resolveCommand(command: string, path: string): Promise<string | undefined> {
  if (isAbsolute(command)) return (await isExecutable(command)) ? command : undefined;
  for (const dir of path.split(delimiter)) {
    const candidate = join(dir, command);
    if (await isExecutable(candidate)) return candidate;
  }
  return undefined;
}

async function isExecutable(file: string): Promise<boolean> {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
