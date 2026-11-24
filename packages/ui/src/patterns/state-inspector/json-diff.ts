export type DiffEntry = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

/**
 * A structural diff of two JSON values, by path. Objects are walked key by
 * key; arrays and scalars are compared whole, which keeps list diffs short.
 */
export function diffJson(before: unknown, after: unknown, path = ""): DiffEntry[] {
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => {
      const child = path ? `${path}.${key}` : key;
      if (!(key in before)) return [{ path: child, kind: "added" as const, after: after[key] }];
      if (!(key in after)) return [{ path: child, kind: "removed" as const, before: before[key] }];
      return diffJson(before[key], after[key], child);
    });
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ path: path || "(root)", kind: "changed", before, after }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
