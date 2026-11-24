import {
  AppError,
  type CoreSecrets,
  type CoreStartConfig,
  type CoreStatus,
} from "@agentic/contracts";
import { moduleLogger } from "@agentic/logger";
import { CoreProcess, type CoreReady } from "./core-process";

const log = moduleLogger("main.core");

const CRASH_WINDOW_MS = 60_000;
const MAX_CRASHES = 5;

type Options = {
  entry: string;
  version: string;
  onRestarted: (ready: CoreReady) => void;
  /** Read at every launch, so a restarted Core gets the current vault values. */
  loadSecrets: () => Promise<CoreSecrets>;
  /** Keeps a secret Core obtained itself (GitHub device sign-in) in the vault. */
  storeSecret: (name: string, value: string) => Promise<void>;
};
type LaunchConfig = Omit<CoreStartConfig, "secrets">;

/**
 * Keeps one Core running for the active database. After a crash it starts
 * Core again with the same config (backing off, at most five times a
 * minute). A new config, e.g. after a DB switch, replaces the process.
 */
export class CoreSupervisor {
  private process: CoreProcess | undefined;
  private config: LaunchConfig | undefined;
  private crashes: number[] = [];
  private current: CoreStatus = { state: "stopped", restarts: 0 };
  private readonly listeners = new Set<(status: CoreStatus) => void>();

  constructor(private readonly options: Options) {}

  status(): CoreStatus {
    return this.current;
  }

  onStatus(listener: (status: CoreStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(config: LaunchConfig): Promise<CoreReady> {
    await this.stop();
    this.config = config;
    this.crashes = [];
    return this.launch(config);
  }

  migrate(): Promise<number> {
    if (!this.process?.ready) throw new AppError("unavailable", "Core is not running");
    return this.process.migrate();
  }

  /** Pushes changed provider secrets to the running Core. */
  async refreshSecrets(): Promise<void> {
    const secrets = await this.options.loadSecrets();
    if (this.process?.ready) this.process.sendSecrets(secrets);
  }

  async stop(): Promise<void> {
    this.config = undefined;
    const process = this.process;
    this.process = undefined;
    await process?.stop();
    if (this.current.state !== "stopped") this.publish({ state: "stopped" });
  }

  private async launch(config: LaunchConfig): Promise<CoreReady> {
    this.publish({ state: "starting" });
    const process = new CoreProcess(
      this.options.entry,
      this.options.version,
      (code) => this.handleExit(process, code),
      (name, value) =>
        void this.options
          .storeSecret(name, value)
          .catch((err: unknown) => log.warn({ err, name }, "could not store a secret from Core")),
    );
    this.process = process;
    try {
      const ready = await process.start({ ...config, secrets: await this.options.loadSecrets() });
      this.publish({ state: "ready", url: ready.url, token: ready.token });
      return ready;
    } catch (err) {
      log.error({ err }, "core failed to start");
      if (this.process === process) this.process = undefined;
      this.publish({ state: "error", error: AppError.from(err).message });
      throw err;
    }
  }

  /** Only a Core that had been ready is restarted; a failing start is reported instead. */
  private handleExit(process: CoreProcess, code: number): void {
    if (this.process !== process || !process.ready || !this.config) return;
    log.error({ code }, "core exited unexpectedly");
    this.process = undefined;
    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < CRASH_WINDOW_MS), now];
    if (this.crashes.length > MAX_CRASHES) {
      log.fatal({ crashes: this.crashes.length }, "core keeps crashing; not restarting");
      this.publish({ state: "error", error: "Core keeps crashing; restart the app" });
      return;
    }
    const config = this.config;
    this.current = { ...this.current, restarts: this.current.restarts + 1 };
    setTimeout(() => {
      if (this.config !== config) return;
      this.launch(config)
        .then(this.options.onRestarted)
        .catch((err: unknown) => log.error({ err }, "core restart failed"));
    }, 500 * this.crashes.length);
  }

  private publish(patch: Omit<CoreStatus, "restarts">): void {
    this.current = { ...patch, restarts: this.current.restarts };
    for (const listener of this.listeners) listener(this.current);
  }
}
