import { spawn } from "node:child_process";
import { AppError } from "@agentic/contracts";

export type RunOptions = {
  /** Written to stdin, so values like passwords never show in `ps`. */
  input?: string;
  /** Run as another user (tests run as root, which Postgres refuses). */
  uid?: number;
  gid?: number;
};

/** Runs a short-lived tool (initdb, tar, postgres --single) and fails with its output tail. */
export function runBinary(file: string, args: string[], options: RunOptions = {}): Promise<void> {
  const { input, uid, gid } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      ...(uid === undefined ? {} : { uid }),
      ...(gid === undefined ? {} : { gid }),
    });
    child.stdin?.end(input);
    const output = new OutputTail();
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => output.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new AppError("internal", `${file} exited with ${code}: ${output.text()}`));
    });
  });
}

/** Keeps the last lines of a process's output for error messages. */
export class OutputTail {
  private lines: string[] = [];

  constructor(private readonly max = 20) {}

  push(chunk: Buffer): void {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim()) this.lines.push(line.trimEnd());
    }
    if (this.lines.length > this.max) this.lines = this.lines.slice(-this.max);
  }

  text(): string {
    return this.lines.join("\n");
  }
}
