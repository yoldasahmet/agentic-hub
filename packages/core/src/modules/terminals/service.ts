import { homedir } from "node:os";
import { type CliExtras, cliSpecs, openCliTerminal, type PtySession } from "@agentic/cli-bridge";
import {
  AppError,
  newId,
  type OpenTerminalInput,
  openTerminalInputSchema,
  type Terminal,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { Scrollback } from "./scrollback";

const MAX_SESSIONS = 8;

type Listener = { data(chunk: string): void; exit(code: number): void };
type Session = {
  info: Terminal;
  workspaceId: string;
  pty: PtySession;
  scrollback: Scrollback;
  listeners: Set<Listener>;
};

/** Where a chat's terminal starts: its working dir, if it has one. */
export type WorkingDirOf = (ctx: LocalContext, chatId: string) => Promise<string | null>;
/** MCP servers and skills for a session's flags, resolved in the workspace. */
export type ExtrasOf = (
  ctx: LocalContext,
  attach: { mcpServers: string[]; skills: string[] },
) => Promise<CliExtras | undefined>;

/**
 * Terminal mode: interactive CLI sessions in PTYs owned by Core, so they
 * survive a renderer reload. Sockets attach to stream output and send
 * keystrokes; closing (or Core stopping) kills the process.
 */
export class TerminalService {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly workingDirOf: WorkingDirOf,
    private readonly extrasOf: ExtrasOf,
  ) {}

  list(ctx: LocalContext): Terminal[] {
    return [...this.sessions.values()]
      .filter((s) => s.workspaceId === ctx.workspaceId)
      .map((s) => s.info);
  }

  async open(ctx: LocalContext, raw: OpenTerminalInput): Promise<Terminal> {
    const input = openTerminalInputSchema.parse(raw);
    if (this.list(ctx).filter((t) => t.exitCode === null).length >= MAX_SESSIONS) {
      throw new AppError("conflict", `Close a terminal first (at most ${MAX_SESSIONS} at once)`);
    }
    const spec = cliSpecs.find((s) => s.id === input.providerId);
    if (!spec) throw new AppError("validation_failed", `${input.providerId} has no terminal mode`);
    const chatDir = input.chatId ? await this.workingDirOf(ctx, input.chatId) : null;
    const opened = await openCliTerminal(spec, {
      cwd: input.cwd ?? chatDir ?? homedir(),
      cols: input.cols,
      rows: input.rows,
      extras: await this.extrasOf(ctx, input),
    });
    const session: Session = {
      info: {
        id: newId(),
        chatId: input.chatId ?? null,
        providerId: spec.id,
        command: opened.command,
        cwd: opened.cwd,
        pid: opened.session.pid,
        exitCode: null,
        createdAt: new Date().toISOString(),
      },
      workspaceId: ctx.workspaceId,
      pty: opened.session,
      scrollback: new Scrollback(),
      listeners: new Set(),
    };
    opened.session.onData((chunk) => {
      session.scrollback.push(chunk);
      for (const listener of session.listeners) listener.data(chunk);
    });
    void opened.session.exited.then(({ code }) => {
      session.info = { ...session.info, exitCode: code };
      for (const listener of session.listeners) listener.exit(code);
    });
    this.sessions.set(session.info.id, session);
    return session.info;
  }

  close(ctx: LocalContext, id: string): void {
    const session = this.get(ctx, id);
    if (session.info.exitCode === null) session.pty.kill();
    this.sessions.delete(id);
  }

  /** Streams output to `listener`, starting with the recent scrollback. */
  attach(ctx: LocalContext, id: string, listener: Listener): () => void {
    const session = this.get(ctx, id);
    listener.data(session.scrollback.text());
    if (session.info.exitCode !== null) listener.exit(session.info.exitCode);
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  write(ctx: LocalContext, id: string, data: string): void {
    const session = this.get(ctx, id);
    if (session.info.exitCode === null) session.pty.write(data);
  }

  resize(ctx: LocalContext, id: string, cols: number, rows: number): void {
    const session = this.get(ctx, id);
    if (session.info.exitCode === null) session.pty.resize(cols, rows);
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      if (session.info.exitCode === null) session.pty.kill();
    }
    this.sessions.clear();
  }

  private get(ctx: LocalContext, id: string): Session {
    const session = this.sessions.get(id);
    if (!session || session.workspaceId !== ctx.workspaceId) {
      throw new AppError("not_found", `Terminal ${id} not found`);
    }
    return session;
  }
}
