import { stdout } from "node:process";
import { AppError } from "@agentic/contracts";
import { ZodError } from "zod";

const color = stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);

export const dim = paint(2);
export const bold = paint(1);
export const green = paint(32);
export const red = paint(31);
export const yellow = paint(33);

export const print = (line = "") => stdout.write(`${line}\n`);
export const printJson = (value: unknown) => print(JSON.stringify(value, null, 2));

/** Left-aligned columns sized to their widest cell. */
export function table(rows: Record<string, string>[], columns: string[]): void {
  if (rows.length === 0) {
    print(dim("(none)"));
    return;
  }
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => (row[col] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  print(bold(line(columns.map((col) => col.toUpperCase()))));
  for (const row of rows) print(line(columns.map((col) => row[col] ?? "")));
}

/** Compact one-line JSON for event payloads, cut at `max` characters. */
export function brief(value: unknown, max = 160): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Errors whose fix is a command. */
const hints: Record<string, string> = {
  "auth.required": "Run `agentic login`.",
  "auth.session_invalid": "Run `agentic login`.",
};

/** One readable message: Zod issues as `path: message` lines instead of raw JSON. */
export function describeError(err: unknown): string {
  if (err instanceof ZodError)
    return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("\n");
  const hint = err instanceof AppError ? hints[err.code] : undefined;
  if (hint && err instanceof Error) return `${err.message} ${hint}`;
  return err instanceof Error ? err.message : String(err);
}
