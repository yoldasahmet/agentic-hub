import {
  AppError,
  type DatabaseTargetInput,
  type DbConnectionConfig,
  dbConnectionStringSchema,
} from "@agentic/contracts";
import type { Vault } from "../vault/vault";
import type { LocalService } from "./local-service";
import { DB_SECRETS } from "./secret-names";

/**
 * Turns a target (from settings or the UI) into a connection config.
 * A remote target without a URL reuses the one saved in the vault.
 */
export async function resolveConnectionConfig(
  target: DatabaseTargetInput,
  deps: { vault: Vault; local: LocalService },
): Promise<DbConnectionConfig> {
  if (target.mode === "local") return deps.local.start();
  const saved = await deps.vault.get(DB_SECRETS.remoteUrl);
  const connectionString = target.connectionString ?? saved;
  if (!connectionString) {
    throw new AppError("validation_failed", "Enter a connection string for the remote database");
  }
  return {
    mode: "remote",
    connectionString: dbConnectionStringSchema.parse(connectionString),
    tls: target.tls,
  };
}
