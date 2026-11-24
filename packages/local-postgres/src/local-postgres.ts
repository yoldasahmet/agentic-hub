import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream, type WriteStream } from "node:fs";
import { resolveBinaries } from "./binaries";
import { findFreePort } from "./free-port";
import { ensureDatabase, ping, type ServerAddress, waitUntilReady } from "./health";
import { initCluster } from "./init-cluster";
import { OutputTail } from "./run-binary";
import { stopStaleServer } from "./stale-server";

/** The cluster's superuser; restores set its password (snapshot.ts). */
export const LOCAL_SUPERUSER = "agentic";

export type LocalPostgresOptions = {
  /** The cluster directory, e.g. `<userData>/postgres/data`. */
  dataDir: string;
  /** Superuser password, generated once and kept in the vault. */
  password: string;
  user?: string;
  database?: string;
  /** Overrides the npm binary package (a packaged app passes its resources dir). */
  binDir?: string;
  /** Appends the server log here. */
  logFile?: string;
  /** Called when the server exits without `stop()`. */
  onUnexpectedExit?: (reason: string) => void;
};

/**
 * The app's own Postgres service: bundled binaries, a cluster in the app
 * data dir, loopback only on a free port, no Unix socket, no Docker.
 */
export class LocalPostgres {
  private child: ChildProcess | undefined;
  private address: ServerAddress | undefined;
  private exitReason: string | undefined;
  private stopping = false;
  private readonly output = new OutputTail();

  constructor(private readonly options: LocalPostgresOptions) {}

  /** Initializes the cluster if needed, starts the server, and waits until it is ready. */
  async start(): Promise<ServerAddress> {
    if (this.address) return this.address;
    const { dataDir, password, user = LOCAL_SUPERUSER, database = "agentic" } = this.options;
    const binaries = await resolveBinaries(this.options.binDir);
    await initCluster({ initdb: binaries.initdb, dataDir, user, password });
    await stopStaleServer(dataDir);

    const port = await findFreePort();
    const address = { host: "127.0.0.1", port, user, password, database };
    this.spawnServer(binaries.postgres, port);
    try {
      await waitUntilReady({ ...address, database: "postgres" }, () => this.exitReason);
      await ensureDatabase(address, database);
    } catch (err) {
      await this.stop();
      throw err;
    }
    this.address = address;
    return address;
  }

  /** Runs `select 1` against the app database. */
  async health(): Promise<boolean> {
    if (!this.address) return false;
    return ping(this.address).then(
      () => true,
      () => false,
    );
  }

  /** Fast shutdown (SIGINT), escalating to SIGQUIT if it hangs. */
  async stop(timeoutMs = 10_000): Promise<void> {
    const child = this.child;
    this.address = undefined;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    this.stopping = true;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.kill("SIGINT");
    const timer = setTimeout(() => child.kill("SIGQUIT"), timeoutMs);
    await exited;
    clearTimeout(timer);
  }

  private spawnServer(postgres: string, port: number): void {
    this.exitReason = undefined;
    this.stopping = false;
    const child = spawn(
      postgres,
      [
        "-D",
        this.options.dataDir,
        "-p",
        String(port),
        "-c",
        "listen_addresses=127.0.0.1",
        // No Unix socket: macOS caps socket paths at 104 bytes, and TCP is all we use.
        "-c",
        "unix_socket_directories=",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const log = this.options.logFile ? createLog(this.options.logFile) : undefined;
    const onData = (chunk: Buffer) => {
      this.output.push(chunk);
      log?.write(chunk);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("error", (err) => {
      this.exitReason = err.message;
    });
    child.once("exit", (code, signal) => {
      log?.end();
      this.exitReason ??= `exit ${code ?? signal}\n${this.output.text()}`;
      const unexpected = !this.stopping && this.address !== undefined;
      this.address = undefined;
      if (unexpected) this.options.onUnexpectedExit?.(this.exitReason);
    });
    this.child = child;
  }
}

function createLog(path: string): WriteStream {
  const stream = createWriteStream(path, { flags: "a", mode: 0o600 });
  stream.on("error", () => undefined);
  return stream;
}
