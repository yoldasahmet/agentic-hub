/**
 * Graph state and stream chunks can hold class instances (LangChain
 * messages, Dates). Round-tripping through JSON makes what we persist and
 * what we broadcast the same plain data.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (typeof v === "bigint" ? String(v) : v)),
  );
}

export function toJsonRecord(value: unknown): Record<string, unknown> {
  const plain = toJsonSafe(value);
  if (plain !== null && typeof plain === "object" && !Array.isArray(plain)) {
    return Object.fromEntries(Object.entries(plain));
  }
  return {};
}
