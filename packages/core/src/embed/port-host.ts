import {
  AppError,
  type CoreToMainMessage,
  type MainToCoreMessage,
  mainToCoreMessageSchema,
} from "@agentic/contracts";
import { type CoreInstance, startCore } from "../core";
import { startCoreLogging } from "../runtime/logging";

/** The parent side of an Electron `utilityProcess` (`process.parentPort`). */
export type ParentPortLike = {
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
};

/**
 * Runs Core inside a utilityProcess: waits for `start` (config and DB
 * credentials arrive over the port, never via env or argv), reports
 * `ready` or `failed`, and answers `migrate` and `shutdown`.
 */
export function serveOverPort(port: ParentPortLike, version: string): void {
  let core: CoreInstance | undefined;
  const send = (message: CoreToMainMessage) => port.postMessage(message);

  const handle = async (message: MainToCoreMessage) => {
    if (message.type === "start") {
      if (core) return;
      startCoreLogging({
        logDir: message.config.logDir,
        dataDir: message.config.dataDir,
        env: process.env,
        // Dev runs show Core's warnings in the terminal next to main's.
        console: process.env.NODE_ENV === "development" ? "warn" : false,
      });
      try {
        // Same override as the headless entry: a gateway or stand-in for OpenRouter.
        const openRouterBaseUrl = process.env.AGENTIC_OPENROUTER_BASE_URL;
        core = await startCore(message.config, {
          version,
          openRouterBaseUrl,
          githubApiUrl: process.env.AGENTIC_GITHUB_API_URL,
          storeSecret: (name, value) => send({ type: "store-secret", name, value }),
        });
        send({
          type: "ready",
          url: core.info.url,
          port: core.info.port,
          token: core.info.token,
          db: core.db,
        });
      } catch (err) {
        send({ type: "failed", error: AppError.from(err).toJSON() });
        process.exit(1);
      }
    } else if (message.type === "migrate") {
      try {
        if (!core) throw new AppError("unavailable", "Core is not started");
        send({ type: "migrated", requestId: message.requestId, applied: await core.migrate() });
      } catch (err) {
        send({
          type: "migrated",
          requestId: message.requestId,
          error: AppError.from(err).toJSON(),
        });
      }
    } else if (message.type === "secrets") {
      core?.setSecrets(message.secrets);
    } else {
      await core?.stop();
      process.exit(0);
    }
  };

  port.on("message", (event) => {
    const parsed = mainToCoreMessageSchema.safeParse(event.data);
    if (parsed.success) void handle(parsed.data);
  });
}
