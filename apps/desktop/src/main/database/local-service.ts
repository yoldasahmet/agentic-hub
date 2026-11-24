import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { DbConnectionConfig } from "@agentic/contracts";
import {
  backupCluster,
  LOCAL_SUPERUSER,
  LocalPostgres,
  resolveBinaries,
  restoreCluster,
  rollbackRestore,
  setClusterPassword,
} from "@agentic/local-postgres";
import type { Vault } from "../vault/vault";
import { DB_SECRETS } from "./secret-names";

type Options = {
  vault: Vault;
  /** `<userData>/postgres`: holds `data/` and `postgres.log`. */
  rootDir: string;
  /** The packaged app ships binaries in its resources (P18.2); dev uses the npm package. */
  binDir?: string;
  onUnexpectedExit: (reason: string) => void;
};

/** The bundled Postgres service, started on demand and stopped with the app. */
export class LocalService {
  private server: LocalPostgres | undefined;

  constructor(private readonly options: Options) {}

  async start(): Promise<DbConnectionConfig> {
    const { rootDir, binDir, onUnexpectedExit } = this.options;
    if (!this.server) {
      await mkdir(rootDir, { recursive: true, mode: 0o700 });
      this.server = new LocalPostgres({
        dataDir: this.dataDir,
        password: await this.password(),
        logFile: join(rootDir, "postgres.log"),
        binDir,
        onUnexpectedExit: (reason) => {
          this.server = undefined;
          onUnexpectedExit(reason);
        },
      });
    }
    const address = await this.server.start().catch(async (err: unknown) => {
      this.server = undefined;
      throw err;
    });
    return { mode: "local", ...address };
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    await server?.stop();
  }

  /** Snapshot of the cluster; call only while the service is stopped (P18.2). */
  backup(file: string): Promise<{ bytes: number }> {
    return backupCluster(this.dataDir, file);
  }

  /** Swaps in a snapshot (service stopped). Returns where the replaced cluster went. */
  async restore(file: string): Promise<string> {
    const { postgres } = await resolveBinaries(this.options.binDir);
    const password = await this.password();
    return restoreCluster({
      file,
      dataDir: this.dataDir,
      setPassword: (dir) => setClusterPassword(postgres, dir, LOCAL_SUPERUSER, password),
    });
  }

  rollbackRestore(previous: string): Promise<void> {
    return rollbackRestore(this.dataDir, previous);
  }

  private get dataDir(): string {
    return join(this.options.rootDir, "data");
  }

  /** Generated on first launch; the cluster is initialized with it, so it never changes. */
  private async password(): Promise<string> {
    const { vault } = this.options;
    const saved = await vault.get(DB_SECRETS.localPassword);
    if (saved) return saved;
    const created = randomBytes(24).toString("base64url");
    await vault.set(DB_SECRETS.localPassword, created);
    return created;
  }
}
