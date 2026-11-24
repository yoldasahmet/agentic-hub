import type { SecretName } from "../secrets";

/** Vault entries the LLM providers need. Main hands them to Core over the process port. */
export const PROVIDER_SECRETS = {
  openrouterApiKey: "openrouter.api-key",
} as const satisfies Record<string, SecretName>;

const providerSecretNames: ReadonlySet<string> = new Set(Object.values(PROVIDER_SECRETS));

export function isProviderSecret(name: string): boolean {
  return providerSecretNames.has(name);
}

/** Vault entries MCP servers point at: `mcp.<anything>`, e.g. "mcp.linear.token". */
export const MCP_SECRET_PREFIX = "mcp.";

/** Vault entries integrations read: `github.*` and `jira.*`. */
const INTEGRATION_SECRET_PREFIXES = ["github.", "jira."];

export function isIntegrationSecret(name: string): boolean {
  return INTEGRATION_SECRET_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Secrets Core holds in memory: provider keys, MCP server secrets, and integration tokens. */
export function isCoreSecret(name: string): boolean {
  return isProviderSecret(name) || name.startsWith(MCP_SECRET_PREFIX) || isIntegrationSecret(name);
}
