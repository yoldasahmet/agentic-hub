import { tmpdir } from "node:os";
import { runProcess } from "@agentic/cli-bridge";

/**
 * The token of an existing `gh auth login`, if gh is installed and signed
 * in. Read on demand and never stored: gh stays the owner of that login.
 */
export async function ghCliToken(host = "github.com"): Promise<string | undefined> {
  try {
    const out = await runProcess("gh", ["auth", "token", "--hostname", host], {
      cwd: tmpdir(),
      timeoutMs: 5_000,
      maxOutputBytes: 4_096,
    });
    const token = out.stdout.trim();
    return out.exitCode === 0 && token ? token : undefined;
  } catch {
    return undefined;
  }
}
