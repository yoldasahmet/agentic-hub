import { dirname } from "node:path";
import { type CoreClient, type CoreConnection, createCoreClient } from "@agentic/client";
import {
  AppError,
  type CoreRuntimeInfo,
  coreTokenSchema,
  sessionTokenSchema,
} from "@agentic/contracts";
import { z } from "zod";
import { locateCores } from "./locate";
import { readSessionFile } from "./session-file";

type Resolved = {
  connection: CoreConnection;
  /** `env`, or the runtime file the connection came from. */
  source: string;
  /** The runtime file's contents; absent for an env connection. */
  info?: CoreRuntimeInfo;
  /** The data dir holding that runtime file, where `agentic login` keeps its session. */
  dataDir?: string;
};
export type Session = Resolved & { client: CoreClient };

const envConnectionSchema = z.object({
  AGENTIC_URL: z.url({ protocol: /^https?$/ }),
  AGENTIC_TOKEN: coreTokenSchema,
});
const envSessionSchema = sessionTokenSchema.optional();

/**
 * AGENTIC_URL + AGENTIC_TOKEN win (a Core started elsewhere); otherwise the
 * newest live runtime file. Never falls back to a file whose process is gone.
 * The session comes from AGENTIC_SESSION, else from `agentic login`.
 */
export async function resolveConnection(dataDir?: string): Promise<Resolved> {
  if (process.env.AGENTIC_URL) {
    const env = envConnectionSchema.parse(process.env);
    const session = envSessionSchema.parse(process.env.AGENTIC_SESSION || undefined);
    return {
      connection: { url: env.AGENTIC_URL, token: env.AGENTIC_TOKEN, session },
      source: "env",
    };
  }
  const live = (await locateCores(dataDir)).find((entry) => entry.alive);
  if (!live) {
    throw new AppError(
      "unavailable",
      "Agentic Hub isn't running. Open the app, or start Core with `agentic serve`.",
    );
  }
  const liveDataDir = dirname(dirname(live.path));
  const session =
    envSessionSchema.parse(process.env.AGENTIC_SESSION || undefined) ??
    (await readSessionFile(liveDataDir))?.token;
  return {
    connection: { url: live.info.url, token: live.info.token, session },
    source: live.path,
    info: live.info,
    dataDir: liveDataDir,
  };
}

export async function connect(dataDir?: string): Promise<Session> {
  const resolved = await resolveConnection(dataDir);
  return { ...resolved, client: createCoreClient(resolved.connection) };
}
