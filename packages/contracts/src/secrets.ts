import { z } from "zod";
import { isoDateTimeSchema } from "./ids";

/**
 * Secret names are dotted keys such as "openrouter.api-key" or
 * "github.token". Other records point at secrets by this name only.
 */
export const secretNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "Use lowercase letters, digits, dots, and dashes");
export type SecretName = z.infer<typeof secretNameSchema>;

export const secretValueSchema = z.string().min(1).max(16_384);

/**
 * Secrets the app writes itself (the local DB password, the remote DB URL,
 * the signed-in session). They are listed but can't be edited on the
 * Secrets page, because changing them there would lock the app out.
 */
const managedPrefixes = ["database.", "auth."];

/** The desktop's signed-in session token (P17). Never sent to Core as a provider secret. */
export const AUTH_SESSION_SECRET = "auth.session";
export function isManagedSecret(name: string): boolean {
  return managedPrefixes.some((prefix) => name.startsWith(prefix));
}

/** What the renderer may see about a secret. Values never leave the main process. */
export const secretMetaSchema = z.object({
  name: secretNameSchema,
  updatedAt: isoDateTimeSchema,
  managed: z.boolean(),
});
export type SecretMeta = z.infer<typeof secretMetaSchema>;

export const vaultStatusSchema = z.object({
  available: z.boolean(),
  /** Electron's safeStorage backend, e.g. "keychain" on macOS. */
  backend: z.string(),
});
export type VaultStatus = z.infer<typeof vaultStatusSchema>;
