import { randomUUID } from "node:crypto";
import {
  AppError,
  type CoreSecrets,
  type CoreStartConfig,
  type CoreToMainMessage,
  coreToMainMessageSchema,
} from "@agentic/contracts";
import { type UtilityProcess, utilityProcess } from "electron";

export type CoreReady = Extract<CoreToMainMessage, { type: "ready" }>;
type Migrated = Extract<CoreToMainMessage, { type: "migrated" }>;

const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 8_000;

/**
 * One Core `utilityProcess`. Credentials go over the message port after
 * spawn, never via env or argv, so other processes can't read them.
 */
export class CoreProcess {
  private readonly child: UtilityProcess;
  private readonly pending = new Map<string, (message: Migrated) => void>();
  private readonly exited: Promise<number>;
  ready = false;

  constructor(
    entry: string,
    version: string,
    onExit: (code: number) => void,
    onStoreSecret: (name: string, value: string) => void,
  ) {
    this.child = utilityProcess.fork(entry, [], {
      serviceName: "Agentic Hub Core",
      env: { ...process.env, AGENTIC_APP_VERSION: version },
    });
    this.exited = new Promise((resolve) => {
      this.child.once("exit", (code) => {
        resolve(code);
        onExit(code);
      });
    });
    this.child.on("message", (data: unknown) => {
      const message = coreToMainMessageSchema.safeParse(data);
      if (message.success && message.data.type === "migrated") {
        this.pending.get(message.data.requestId)?.(message.data);
      } else if (message.success && message.data.type === "store-secret") {
        onStoreSecret(message.data.name, message.data.value);
      }
    });
  }

  start(config: CoreStartConfig): Promise<CoreReady> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => fail(new AppError("unavailable", "Core did not start in time")),
        START_TIMEOUT_MS,
      );
      const fail = (err: AppError) => {
        clearTimeout(timer);
        this.child.kill();
        reject(err);
      };
      this.child.on("message", (data: unknown) => {
        const message = coreToMainMessageSchema.safeParse(data);
        if (!message.success) return;
        if (message.data.type === "ready") {
          clearTimeout(timer);
          this.ready = true;
          resolve(message.data);
        } else if (message.data.type === "failed") {
          fail(new AppError(message.data.error.code, message.data.error.message));
        }
      });
      void this.exited.then((code) => fail(new AppError("unavailable", `Core exited (${code})`)));
      this.child.postMessage({ type: "start", config });
    });
  }

  migrate(): Promise<number> {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, (message) => {
        this.pending.delete(requestId);
        if (message.error) reject(new AppError(message.error.code, message.error.message));
        else resolve(message.applied ?? 0);
      });
      this.child.postMessage({ type: "migrate", requestId });
    });
  }

  sendSecrets(secrets: CoreSecrets): void {
    this.child.postMessage({ type: "secrets", secrets });
  }

  /** Asks Core to shut down cleanly (it hands its jobs back), then kills it if it hangs. */
  async stop(): Promise<void> {
    if (this.child.pid === undefined) return;
    this.child.postMessage({ type: "shutdown" });
    const timer = setTimeout(() => this.child.kill(), STOP_TIMEOUT_MS);
    await this.exited;
    clearTimeout(timer);
  }
}
