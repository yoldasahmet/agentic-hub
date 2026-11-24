import { AppError } from "@agentic/contracts";
import { parse } from "../args";
import { connect } from "../connect";
import { bold, dim, print, printJson } from "../output";

export const statusUsage = "agentic status [--json]";

function uptime(startedAt: string | undefined): string {
  if (!startedAt) return "";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : `${seconds}s`;
}

/** Which Core the CLI talks to, its version, who it acts as, and what is running or waiting. */
export async function statusCommand(rest: string[]): Promise<number> {
  const { values } = parse(rest, {});
  const { client, connection, source, info } = await connect(values["data-dir"]);
  const [health, auth] = await Promise.all([client.health(), client.auth.status()]);
  if (!auth.user) {
    throw new AppError("auth.required", "This Core needs a sign-in (team database).");
  }
  const [running, inbox] = await Promise.all([
    client.runs.list({ status: "running", limit: 200 }),
    client.inbox(),
  ]);
  const summary = {
    url: connection.url,
    source,
    pid: info?.pid ?? null,
    version: health.version,
    startedAt: info?.startedAt ?? null,
    user: { ...auth.user, role: auth.role, signedIn: auth.signedIn },
    running: running.length,
    waiting: inbox.length,
  };
  if (values.json) {
    printJson(summary);
    return 0;
  }
  print(`${bold("Core")}     ${summary.url} ${dim(`v${summary.version}`)}`);
  if (info) print(`${bold("pid")}      ${info.pid} ${dim(`up ${uptime(info.startedAt)}`)}`);
  print(`${bold("found")}    ${source === "env" ? "AGENTIC_URL" : source}`);
  const how = auth.signedIn ? auth.role : `${auth.role}, signed in automatically`;
  print(`${bold("user")}     ${auth.user.email ?? auth.user.displayName} ${dim(`(${how})`)}`);
  print(`${bold("runs")}     ${summary.running} running · ${summary.waiting} waiting at a gate`);
  return 0;
}
