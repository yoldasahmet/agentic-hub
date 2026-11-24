import { z } from "zod";

/** Local = the bundled Postgres service. Remote = a team DB via a connection string. */
export const dbModeSchema = z.enum(["local", "remote"]);
export type DbMode = z.infer<typeof dbModeSchema>;

/**
 * TLS for the remote DB. `verify-full` checks the certificate chain and host
 * name; `require` encrypts without verifying (self-signed team servers).
 */
export const dbTlsModeSchema = z.enum(["verify-full", "require", "disable"]);
export type DbTlsMode = z.infer<typeof dbTlsModeSchema>;

export const dbConnectionStringSchema = z
  .string()
  .trim()
  .max(4096)
  .regex(/^postgres(ql)?:\/\/\S+$/, "Use a postgres:// or postgresql:// URL");

/** Non-secret database settings. The remote connection string lives in the vault. */
export const databaseSettingsSchema = z.object({
  mode: dbModeSchema,
  tls: dbTlsModeSchema,
});
export type DatabaseSettings = z.infer<typeof databaseSettingsSchema>;

export const defaultDatabaseSettings: DatabaseSettings = { mode: "local", tls: "verify-full" };

/** A connection the database layer can open. Built in main from settings + vault. */
export const dbConnectionConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("local"),
    host: z.string(),
    port: z.number().int().min(1).max(65_535),
    user: z.string(),
    password: z.string(),
    database: z.string(),
  }),
  z.object({
    mode: z.literal("remote"),
    connectionString: dbConnectionStringSchema,
    tls: dbTlsModeSchema,
  }),
]);
export type DbConnectionConfig = z.infer<typeof dbConnectionConfigSchema>;

export const dbStateSchema = z.enum(["starting", "ready", "error", "stopped"]);
export type DbState = z.infer<typeof dbStateSchema>;

/** What the UI may see about the active database. Never includes credentials. */
export const databaseStatusSchema = z.object({
  settings: databaseSettingsSchema,
  state: dbStateSchema,
  /** "127.0.0.1:54329" or the remote host and database, without user or password. */
  target: z.string().optional(),
  serverVersion: z.string().optional(),
  error: z.string().optional(),
  remoteConfigured: z.boolean(),
  migrationsApplied: z.number().int().nonnegative().optional(),
});
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;

/** A proposed database to test or switch to. Omit the URL to reuse the saved one. */
export const databaseTargetInputSchema = z.object({
  mode: dbModeSchema,
  tls: dbTlsModeSchema,
  connectionString: dbConnectionStringSchema.optional(),
});
export type DatabaseTargetInput = z.infer<typeof databaseTargetInputSchema>;

export const connectionTestResultSchema = z.object({
  serverVersion: z.string(),
  latencyMs: z.number().nonnegative(),
});
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;
