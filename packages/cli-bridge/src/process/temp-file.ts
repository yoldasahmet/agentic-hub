import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A private (0600, own dir) temp file for flags that only take a path. */
export async function writeTempFile(
  name: string,
  content: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "agentic-cli-"));
  const path = join(dir, name);
  await writeFile(path, content, { mode: 0o600 });
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
