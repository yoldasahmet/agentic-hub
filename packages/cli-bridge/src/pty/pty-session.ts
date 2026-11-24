import { AppError } from "@agentic/contracts";

export type PtyOptions = {
  /** An absolute path from `resolveCommand`. */
  command: string;
  args: readonly string[];
  /** Already checked by `validateWorkingDir`. */
  cwd: string;
  env: Record<string, string>;
  cols?: number;
  rows?: number;
};

export type PtySession = {
  pid: number;
  onData(listener: (chunk: string) => void): () => void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Ctrl-C, like a person pressing it. */
  interrupt(): void;
  kill(): void;
  exited: Promise<{ code: number; signal?: number }>;
};

type NodePty = typeof import("node-pty");
let loaded: Promise<NodePty> | undefined;

/** node-pty is native; load it only when a PTY is needed so a broken build can't stop Core. */
function loadPty(): Promise<NodePty> {
  loaded ??= import("node-pty").catch((err: unknown) => {
    loaded = undefined;
    throw new AppError("cli.pty_unavailable", "Terminal mode is unavailable on this build", {
      cause: err instanceof Error ? err.message : String(err),
    });
  });
  return loaded;
}

/**
 * The fallback for CLIs (or modes) without a structured stream: a real
 * terminal whose raw output the UI renders as-is. Terminal mode in chat
 * (P8.7) builds on this.
 */
export async function openPty(options: PtyOptions): Promise<PtySession> {
  const pty = await loadPty();
  const term = pty.spawn(options.command, [...options.args], {
    name: "xterm-256color",
    cols: options.cols ?? 120,
    rows: options.rows ?? 32,
    cwd: options.cwd,
    env: options.env,
  });
  const exited = new Promise<{ code: number; signal?: number }>((resolve) => {
    term.onExit(({ exitCode, signal }) => resolve({ code: exitCode, signal }));
  });
  return {
    pid: term.pid,
    onData: (listener) => {
      const sub = term.onData(listener);
      return () => sub.dispose();
    },
    write: (data) => term.write(data),
    resize: (cols, rows) => term.resize(cols, rows),
    interrupt: () => term.write("\x03"),
    kill: () => term.kill(),
    exited,
  };
}
