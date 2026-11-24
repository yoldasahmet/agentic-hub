import { z } from "zod";

/**
 * The ten identity hues from docs/design-system.md. Stored as text and
 * validated here, so adding a hue never needs a migration.
 */
export const identityColors = [
  "terracotta",
  "amber",
  "olive",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "plum",
  "slate",
] as const;
export const identityColorSchema = z.enum(identityColors);
export type IdentityColor = z.infer<typeof identityColorSchema>;

/** A Lucide icon name in kebab-case (e.g. "git-pull-request"). The UI falls back for unknown names. */
export const identityIconSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type IdentityIcon = z.infer<typeof identityIconSchema>;

export const entityIdentitySchema = z.object({
  name: z.string().min(1).max(120),
  color: identityColorSchema,
  icon: identityIconSchema,
});
export type EntityIdentity = z.infer<typeof entityIdentitySchema>;

/** Default color for a new entity: a stable FNV-1a hash of its id, so it never changes between screens. */
export function colorForId(id: string): IdentityColor {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return identityColors[(hash >>> 0) % identityColors.length] ?? "slate";
}
