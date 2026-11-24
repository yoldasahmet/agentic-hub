import {
  AppError,
  type ConnectionTestResult,
  type DatabaseStatus,
  type DatabaseTargetInput,
} from "@agentic/contracts";
import { testConnection } from "@agentic/db";
import { moduleLogger } from "@agentic/logger";
import type { CoreReady } from "../core/core-process";
import type { CoreSupervisor } from "../core/core-supervisor";
import type { Vault } from "../vault/vault";
import { resolveConnectionConfig } from "./connection-config";
import type { DatabaseSettingsFile } from "./database-settings";
import type { LocalService } from "./local-service";
import { DB_SECRETS } from "./secret-names";

const log = moduleLogger("main.database");

type Deps = {
  vault: Vault;
  local: LocalService;
  settings: DatabaseSettingsFile;
  core: CoreSupervisor;
  /** Where Core writes `runtime/core.json`. */
  dataDir: string;
  /** Where Core writes `core.log`, next to main's. */
  logDir: string;
  migrationsFolder: string;
};

/**
 * Owns which database is active: starts the local service or resolves the
 * remote DB, then (re)starts Core on it. Core holds the pool, migrates, and
 * bootstraps (ADR 0002, P4.2); main only tests a target before a switch.
 */
export class DatabaseSupervisor {
  private current: DatabaseStatus | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private lastAutoRestart = 0;
  private readonly listeners = new Set<(status: DatabaseStatus) => void>();

  constructor(private readonly deps: Deps) {}

  onStatus(listener: (status: DatabaseStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async status(): Promise<DatabaseStatus> {
    return this.current ?? this.publish({ state: "stopped" });
  }

  start(): Promise<DatabaseStatus> {
    return this.serialize(() => this.connect());
  }

  test(target: DatabaseTargetInput): Promise<ConnectionTestResult> {
    return resolveConnectionConfig(target, this.deps).then(testConnection);
  }

  /** Tests the target first, so a bad URL never replaces a working setup. */
  switchTo(target: DatabaseTargetInput): Promise<DatabaseStatus> {
    return this.serialize(async () => {
      await this.test(target);
      if (target.mode === "remote" && target.connectionString) {
        await this.deps.vault.set(DB_SECRETS.remoteUrl, target.connectionString);
      }
      await this.deps.settings.write({ mode: target.mode, tls: target.tls });
      await this.deps.core.stop();
      if (target.mode === "remote") await this.deps.local.stop();
      return this.connect();
    });
  }

  migrate(): Promise<DatabaseStatus> {
    return this.serialize(async () => {
      const applied = await this.deps.core.migrate();
      return this.publish({ ...(await this.status()), migrationsApplied: applied });
    });
  }

  /**
   * Stops Core and the local service, runs `task` on the stopped cluster,
   * then reconnects whether it worked or not (backup and restore, P18.2).
   */
  withLocalStopped<T>(task: () => Promise<T>): Promise<{ result: T; status: DatabaseStatus }> {
    return this.serialize(async () => {
      if ((await this.deps.settings.read()).mode !== "local") {
        throw new AppError(
          "validation_failed",
          "Backups cover the local database. Switch to Local first.",
        );
      }
      await this.publish({ state: "starting" });
      await this.deps.core.stop();
      await this.deps.local.stop();
      try {
        const result = await task();
        return { result, status: await this.connect() };
      } catch (err) {
        await this.connect();
        throw err;
      }
    });
  }

  /** Stops Core, then the local service. Called on quit. */
  stop(): Promise<void> {
    return this.serialize(async () => {
      await this.deps.core.stop();
      await this.deps.local.stop();
    });
  }

  /** The local service died on its own: report it, and restart at most once a minute. */
  handleLocalExit(reason: string): void {
    log.error({ reason }, "local database stopped unexpectedly");
    void this.serialize(async () => {
      await this.deps.core.stop();
      await this.publish({ state: "error", error: `Local database stopped: ${reason}` });
    });
    if (Date.now() - this.lastAutoRestart < 60_000) return;
    this.lastAutoRestart = Date.now();
    void this.start();
  }

  private async connect(): Promise<DatabaseStatus> {
    await this.publish({ state: "starting" });
    const settings = await this.deps.settings.read();
    try {
      const db = await resolveConnectionConfig(settings, this.deps);
      const { dataDir, migrationsFolder, logDir } = this.deps;
      return this.ready(await this.deps.core.start({ db, dataDir, migrationsFolder, logDir }));
    } catch (err) {
      log.error({ err, mode: settings.mode }, "database connection failed");
      await this.deps.core.stop();
      return this.publish({ state: "error", error: AppError.from(err).message });
    }
  }

  /** Core reached the DB, migrated, and bootstrapped: the DB is ready. */
  ready({ db }: CoreReady): Promise<DatabaseStatus> {
    return this.publish({
      state: "ready",
      target: db.target,
      serverVersion: db.serverVersion,
      migrationsApplied: db.migrationsApplied,
    });
  }

  private async publish(
    patch: Omit<DatabaseStatus, "settings" | "remoteConfigured">,
  ): Promise<DatabaseStatus> {
    const status: DatabaseStatus = {
      ...patch,
      settings: await this.deps.settings.read(),
      remoteConfigured: (await this.deps.vault.get(DB_SECRETS.remoteUrl)) !== undefined,
    };
    if (status.state !== this.current?.state) {
      log.info(
        { state: status.state, target: status.target, error: status.error },
        "database status",
      );
    }
    this.current = status;
    for (const listener of this.listeners) listener(status);
    return status;
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
