import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emailSchema, isoDateTimeSchema, sessionTokenSchema } from "@agentic/contracts";
import { z } from "zod";

/**
 * `<dataDir>/cli/session.json` (mode 0600 in a 0700 folder): the session
 * from `agentic login`, next to the runtime file of the Core it signed in
 * to. There is no Keychain from a plain Node process (docs/security.md).
 */
const sessionFileSchema = z.object({
  token: sessionTokenSchema,
  email: emailSchema,
  expiresAt: isoDateTimeSchema,
});
export type SessionFile = z.infer<typeof sessionFileSchema>;

const sessionPath = (dataDir: string) => join(dataDir, "cli", "session.json");

export async function readSessionFile(dataDir: string): Promise<SessionFile | undefined> {
  try {
    const parsed = sessionFileSchema.safeParse(
      JSON.parse(await readFile(sessionPath(dataDir), "utf8")),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Written to a temp file first, so the token is never readable with looser permissions. */
export async function writeSessionFile(dataDir: string, session: SessionFile): Promise<string> {
  const path = sessionPath(dataDir);
  await mkdir(join(dataDir, "cli"), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(sessionFileSchema.parse(session), null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temp, path);
  return path;
}

export async function removeSessionFile(dataDir: string): Promise<boolean> {
  const existed = (await readSessionFile(dataDir)) !== undefined;
  await rm(sessionPath(dataDir), { force: true });
  return existed;
}
