import type { SecretName } from "@agentic/contracts";

/** Vault entries owned by the database layer. */
export const DB_SECRETS = {
  localPassword: "database.local-password",
  remoteUrl: "database.remote-url",
} as const satisfies Record<string, SecretName>;
