import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { parse } from "../args";
import { connect } from "../connect";
import { locateCores } from "../locate";
import { describeError, dim, green, print, printJson, red, yellow } from "../output";

export const doctorUsage = "agentic doctor [--json]";

type Level = "ok" | "warn" | "fail";
type Check = { name: string; level: Level; detail: string };

const mark: Record<Level, string> = { ok: green("✓"), warn: yellow("!"), fail: red("✗") };

async function onPath(command: string): Promise<string | undefined> {
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const path = join(dir, command);
    if (
      await access(path, constants.X_OK).then(
        () => true,
        () => false,
      )
    )
      return path;
  }
  return undefined;
}

/** Can the CLI find Core, is it healthy, and can it run models? Exit 1 on any failure. */
export async function doctorCommand(rest: string[]): Promise<number> {
  const { values } = parse(rest, {});
  const checks: Check[] = [];
  const add = (name: string, level: Level, detail: string) => checks.push({ name, level, detail });

  const major = Number(process.versions.node.split(".")[0]);
  add("node", major >= 22 ? "ok" : "fail", `Node ${process.versions.node} (needs 22+)`);
  const installed = await onPath("agentic");
  add("cli", installed ? "ok" : "warn", installed ?? "not on PATH (app menu → Install CLI…)");

  if (process.env.AGENTIC_URL) add("runtime", "ok", `AGENTIC_URL=${process.env.AGENTIC_URL}`);
  else {
    const found = await locateCores(values["data-dir"]);
    if (found.length === 0)
      add("runtime", "fail", "no runtime file: is the app or `serve` running?");
    for (const entry of found)
      add(
        "runtime",
        entry.alive ? "ok" : "warn",
        `${entry.path} (pid ${entry.info.pid}${entry.alive ? "" : ", not running: stale"})`,
      );
  }

  // Each step needs the one before it, so the first failure ends the list.
  let step = "core";
  try {
    const { client, connection } = await connect(values["data-dir"]);
    const started = performance.now();
    const health = await client.health();
    const ms = Math.round(performance.now() - started);
    add("core", "ok", `${connection.url} v${health.version} (${ms} ms)`);
    step = "token";
    await client.assistants();
    add("token", "ok", "accepted");
    step = "llm";
    for (const p of await client.llm.providers()) {
      const usable = p.installed && p.signedIn !== false;
      const state = !p.installed
        ? "not installed"
        : p.signedIn === false
          ? "not signed in"
          : "ready";
      add(`llm ${p.id}`, usable ? "ok" : "warn", `${state}${p.version ? ` · ${p.version}` : ""}`);
    }
  } catch (err) {
    add(step, "fail", describeError(err));
  }

  if (values.json) printJson(checks);
  else for (const c of checks) print(`${mark[c.level]} ${c.name.padEnd(16)} ${dim(c.detail)}`);
  return checks.some((c) => c.level === "fail") ? 1 : 0;
}
