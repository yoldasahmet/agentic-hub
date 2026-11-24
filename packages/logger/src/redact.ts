const TOKEN_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/gi,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bags_[A-Za-z0-9_-]{20,}/g,
  /\bATATT[A-Za-z0-9_=-]{20,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

/**
 * Keys whose values are never logged, whatever they hold: `token`,
 * `accessToken`, `apiKey`, `secrets`… but not counters like `inputTokens`.
 */
const SECRET_KEY =
  /(token|secrets?|passw(or)?d|api[-_]?key|authorization|cookie|credentials?|connection[-_]?string|private[-_]?key)$/i;

export const MASK = "[redacted]";
const MAX_DEPTH = 8;
const MAX_ITEMS = 100;

const known = new Set<string>();

/** Exact values to mask everywhere (vault entries Core holds). Replaces the previous set. */
export function setSecretValues(values: Iterable<string>): void {
  known.clear();
  for (const value of values) if (value.length >= 6) known.add(value);
}

/** Masks known secret values and common token shapes in free text. */
export function redactText(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const secret of [...secrets, ...known]) {
    if (secret.length >= 6) out = out.split(secret).join(MASK);
  }
  for (const pattern of TOKEN_PATTERNS) out = out.replace(pattern, MASK);
  return out;
}

/**
 * Deep copy with every string scrubbed by `redactText`, keeping the shape
 * and every key: for data that is not a log line (run events), where a
 * field named `token` may be a user's legitimate output.
 */
export function redactStrings(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactStrings);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactStrings(v)]));
}

/**
 * Deep copy with secret-named keys masked, strings scrubbed, and errors
 * flattened (message, code, stack). Bounded so a huge payload can't stall logging.
 */
export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (value instanceof Error) return redactValue(flattenError(value), depth);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => redactValue(item, depth + 1));
  }
  if (value instanceof Date) return value.toISOString();
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_ITEMS)) {
    out[key] = SECRET_KEY.test(key) && item != null ? MASK : redactValue(item, depth + 1);
  }
  return out;
}

function flattenError(err: Error): Record<string, unknown> {
  const out: Record<string, unknown> = { type: err.name, message: err.message };
  const extra: Record<string, unknown> = { ...err };
  for (const [key, item] of Object.entries(extra)) if (item !== undefined) out[key] = item;
  if (err.stack) out.stack = err.stack;
  if (err.cause !== undefined) out.cause = err.cause;
  return out;
}
