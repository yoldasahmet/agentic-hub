import { type CoreSecrets, isCoreSecret } from "@agentic/contracts";
import type { Vault } from "../vault/vault";

/**
 * The vault entries Core needs (provider keys and `mcp.*` secrets for MCP
 * servers), read fresh for each hand-over.
 */
export async function loadProviderSecrets(vault: Vault): Promise<CoreSecrets> {
  const secrets: CoreSecrets = {};
  for (const { name } of await vault.list()) {
    if (!isCoreSecret(name)) continue;
    const value = await vault.get(name).catch(() => undefined);
    if (value) secrets[name] = value;
  }
  return secrets;
}
