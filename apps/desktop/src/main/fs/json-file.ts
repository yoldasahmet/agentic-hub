import { readFile, rename, writeFile } from "node:fs/promises";
import type { z } from "zod";

/** Reads and validates a JSON file. A missing file yields `fallback()`. */
export async function readJsonFile<T extends z.ZodType>(
  path: string,
  schema: T,
  fallback: () => z.output<T>,
): Promise<z.output<T>> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return fallback();
    throw err;
  }
  return schema.parse(JSON.parse(raw));
}

/** Atomic write (temp file + rename), readable by the current user only. */
export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}
