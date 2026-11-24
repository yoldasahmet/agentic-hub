import { z } from "zod";

/**
 * Every primary key is a UUIDv7: time-sortable, so indexes stay append-mostly
 * and ids can double as a stable creation order across app instances.
 */
export const idSchema = z.uuidv7();
export type Id = z.infer<typeof idSchema>;

/** Generates a UUIDv7 (RFC 9562): 48-bit ms timestamp + version, variant, randomness. */
export function newId(now: number = Date.now()): Id {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** URL-safe, human-readable identifier for agents, workflows, and nodes. */
export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single dashes");
export type Slug = z.infer<typeof slugSchema>;

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
