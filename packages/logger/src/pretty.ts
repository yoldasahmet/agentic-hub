const COLORS: Record<string, string> = {
  trace: "\x1b[90m",
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[35m",
};
const RESET = "\x1b[0m";
const HIDDEN = new Set(["time", "level", "msg", "proc", "pid", "module"]);

/** One JSON log line as a short human line for a terminal (headless Core, dev). */
export function prettyLine(json: string, color: boolean): string {
  let line: Record<string, unknown>;
  try {
    line = JSON.parse(json);
  } catch {
    return json;
  }
  const level = String(line.level ?? "info");
  const time = typeof line.time === "string" ? line.time.slice(11, 23) : "";
  const tag = color ? `${COLORS[level] ?? ""}${level.toUpperCase()}${RESET}` : level.toUpperCase();
  const where = line.module ? ` [${String(line.module)}]` : "";
  const extra = Object.entries(line)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
  return `${time} ${tag}${where} ${String(line.msg ?? "")}${extra ? ` ${extra}` : ""}\n`;
}
