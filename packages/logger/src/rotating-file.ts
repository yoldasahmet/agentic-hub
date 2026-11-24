import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";

/** `core.log` → `core.1.log`: the n-th older file. */
export const rotatedPath = (path: string, n: number): string => path.replace(/\.log$/, `.${n}.log`);

/**
 * An append-only log file that rolls over by size and keeps `keep` older
 * files. Writes are synchronous so the last lines survive a crash; a
 * failing write (disk full) is dropped, since logging must never break the app.
 */
export class RotatingFile {
  private fd: number | undefined;
  private size = 0;

  constructor(
    readonly path: string,
    private readonly maxBytes: number,
    private readonly keep: number,
  ) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.open();
  }

  write(line: string): void {
    const bytes = Buffer.byteLength(line);
    if (this.size > 0 && this.size + bytes > this.maxBytes) this.rotate();
    if (this.fd === undefined) return;
    try {
      writeSync(this.fd, line);
      this.size += bytes;
    } catch {
      // Dropped: see the class comment.
    }
  }

  close(): void {
    if (this.fd !== undefined) closeSync(this.fd);
    this.fd = undefined;
  }

  private open(): void {
    try {
      this.fd = openSync(this.path, "a", 0o600);
      this.size = fstatSync(this.fd).size;
    } catch {
      this.fd = undefined;
    }
  }

  private rotate(): void {
    this.close();
    try {
      rmSync(rotatedPath(this.path, this.keep), { force: true });
      for (let n = this.keep - 1; n >= 1; n--) {
        const from = rotatedPath(this.path, n);
        if (existsSync(from)) renameSync(from, rotatedPath(this.path, n + 1));
      }
      renameSync(this.path, rotatedPath(this.path, 1));
    } catch {
      // Another process may hold the files; keep appending to the current one.
    }
    this.open();
  }
}
