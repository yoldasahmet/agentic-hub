import { z } from "zod";
import { dbConnectionConfigSchema } from "../database";
import { appErrorSchema } from "../errors";
import { secretNameSchema, secretValueSchema } from "../secrets";
import { coreTokenSchema } from "./runtime";

export const coreSecretsSchema = z.record(secretNameSchema, secretValueSchema);
export type CoreSecrets = z.infer<typeof coreSecretsSchema>;

/** What Core needs to start. Main sends it over the process port, never via env or argv. */
export const coreStartConfigSchema = z.object({
  db: dbConnectionConfigSchema,
  /** Holds `runtime/core.json`. */
  dataDir: z.string().min(1),
  /** The SQL migrations folder; bundled hosts copy it next to their code. */
  migrationsFolder: z.string().min(1).optional(),
  /** Where Core writes `core.log` (main passes its own log folder); default `<dataDir>/logs`. */
  logDir: z.string().min(1).optional(),
  /** Provider secrets from the vault (e.g. the OpenRouter key), kept in Core's memory only. */
  secrets: coreSecretsSchema.default({}),
});
export type CoreStartConfig = z.infer<typeof coreStartConfigSchema>;

export const coreDbInfoSchema = z.object({
  target: z.string(),
  serverVersion: z.string(),
  migrationsApplied: z.number().int().nonnegative(),
});
export type CoreDbInfo = z.infer<typeof coreDbInfoSchema>;

/** Main → Core over the utilityProcess port. */
export const mainToCoreMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), config: coreStartConfigSchema }),
  z.object({ type: z.literal("migrate"), requestId: z.string() }),
  /** Replaces Core's provider secrets after one changes in the vault. */
  z.object({ type: z.literal("secrets"), secrets: coreSecretsSchema }),
  z.object({ type: z.literal("shutdown") }),
]);
export type MainToCoreMessage = z.infer<typeof mainToCoreMessageSchema>;

/** Core → main. `failed` is sent before Core exits on a startup error. */
export const coreToMainMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    url: z.string(),
    port: z.number().int(),
    token: coreTokenSchema,
    db: coreDbInfoSchema,
  }),
  z.object({ type: z.literal("failed"), error: appErrorSchema }),
  /** A secret Core obtained (a GitHub device-flow token) for main to keep in the vault. */
  z.object({ type: z.literal("store-secret"), name: secretNameSchema, value: secretValueSchema }),
  z.object({
    type: z.literal("migrated"),
    requestId: z.string(),
    applied: z.number().int().nonnegative().optional(),
    error: appErrorSchema.optional(),
  }),
]);
export type CoreToMainMessage = z.infer<typeof coreToMainMessageSchema>;
