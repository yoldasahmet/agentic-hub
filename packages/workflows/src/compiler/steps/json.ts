import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.json());

/** Values bound from JSON state are JSON; a round trip drops `undefined` and proves it. */
export function jsonRecord(value: Record<string, unknown>) {
  return jsonRecordSchema.parse(JSON.parse(JSON.stringify(value)));
}
