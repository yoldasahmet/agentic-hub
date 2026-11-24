import { AppError } from "@agentic/contracts";
import { parse } from "../args";
import { connect } from "../connect";
import { bold, dim, print, printJson } from "../output";
import { ask, askHidden, readStdin } from "../prompt";
import { removeSessionFile, writeSessionFile } from "../session-file";

export const loginUsage = `agentic login [--email EMAIL] [--password-stdin]
  Signs in to the running Core (required on a team DB) and keeps the
  session in <data-dir>/cli/session.json. Asks for what isn't given.`;

export const logoutUsage = `agentic logout
  Ends that session and deletes the file.`;

/** A data dir to keep the session in: env connections use AGENTIC_SESSION instead. */
function requireDataDir(dataDir: string | undefined): string {
  if (!dataDir) {
    throw new AppError(
      "validation_failed",
      "With AGENTIC_URL set, pass the session as AGENTIC_SESSION instead of signing in here.",
    );
  }
  return dataDir;
}

export async function loginCommand(rest: string[]): Promise<number> {
  const { values } = parse(rest, {
    email: { type: "string" },
    "password-stdin": { type: "boolean" },
  });
  const { client, dataDir } = await connect(values["data-dir"]);
  const dir = requireDataDir(dataDir);
  const email = values.email ?? (await ask("Email: "));
  const password = values["password-stdin"] ? await readStdin() : await askHidden("Password: ");
  const session = await client.auth.signIn({ email, password, client: "cli" });
  const path = await writeSessionFile(dir, {
    token: session.token,
    email: session.user.email ?? email,
    expiresAt: session.expiresAt,
  });
  if (values.json) {
    printJson({ user: session.user, role: session.role, expiresAt: session.expiresAt });
    return 0;
  }
  print(`Signed in as ${bold(session.user.displayName)} ${dim(`(${session.role})`)}`);
  print(dim(`Session saved to ${path}, valid until ${session.expiresAt.slice(0, 10)}.`));
  return 0;
}

export async function logoutCommand(rest: string[]): Promise<number> {
  const { values } = parse(rest, {});
  const { client, connection, dataDir } = await connect(values["data-dir"]);
  const dir = requireDataDir(dataDir);
  // Best effort: the file goes even if Core already forgot the session.
  if (connection.session) await client.auth.signOut().catch(() => undefined);
  const removed = await removeSessionFile(dir);
  if (values.json) printJson({ signedOut: removed });
  else print(removed ? "Signed out." : dim("No saved session."));
  return 0;
}
