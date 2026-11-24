import { type ParseArgsConfig, parseArgs } from "node:util";
import { AppError, type JsonValue, jsonValueSchema } from "@agentic/contracts";

type OptionMap = NonNullable<ParseArgsConfig["options"]>;

/** Accepted by every command. */
export const commonOptions = {
  json: { type: "boolean" },
  "data-dir": { type: "string" },
  help: { type: "boolean", short: "h" },
} as const satisfies OptionMap;

/** Strict parsing: an unknown flag is an error, not something silently ignored. */
export function parse<const T extends OptionMap>(args: string[], options: T) {
  return parseArgs({
    args,
    options: { ...commonOptions, ...options },
    allowPositionals: true,
    strict: true,
  });
}

export function usageError(message: string): AppError {
  return new AppError("validation_failed", message);
}

/** The positional at `index`, or a usage error naming what was expected. */
export function required(positionals: string[], index: number, name: string): string {
  const value = positionals[index];
  if (!value) throw usageError(`Missing <${name}>.`);
  return value;
}

/** JSON from a flag; Zod checks it is plain JSON (no cast on CLI input). */
export function parseJson(text: string, flag: string): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw usageError(`${flag} is not valid JSON.`);
  }
  return jsonValueSchema.parse(value);
}

/** A value from `key=value`: JSON when it parses (numbers, booleans, objects), else the text. */
function looseJson(text: string): JsonValue {
  try {
    return jsonValueSchema.parse(JSON.parse(text));
  } catch {
    return text;
  }
}

/** `--input-json '{…}'` as the base, then each `--input key=value` on top. */
export function parseInputs(pairs: string[] = [], json?: string): Record<string, JsonValue> {
  const base = json === undefined ? {} : parseJson(json, "--input-json");
  if (typeof base !== "object" || base === null || Array.isArray(base))
    throw usageError("--input-json must be a JSON object.");
  const input: Record<string, JsonValue> = { ...base };
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at < 1) throw usageError(`--input expects key=value, got "${pair}".`);
    input[pair.slice(0, at)] = looseJson(pair.slice(at + 1));
  }
  return input;
}

/** `draft` or a published version number. */
export function parseVersion(text: string | undefined): "draft" | number {
  if (text === undefined || text === "draft") return "draft";
  const version = Number(text);
  if (!Number.isInteger(version) || version < 1)
    throw usageError(`--version must be "draft" or a version number, got "${text}".`);
  return version;
}
