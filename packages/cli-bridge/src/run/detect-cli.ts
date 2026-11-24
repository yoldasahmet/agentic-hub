import type { ProviderStatus } from "@agentic/contracts";
import { buildChildEnv } from "../process/child-env";
import { runCommand } from "../process/run-command";
import { resolveCommand, searchPath } from "../process/search-path";
import type { CliSpec } from "../specs/cli-spec";

const VERSION = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/;

/** Installed? Which version? Signed in? Never throws; unknowns are reported as such. */
export async function detectCli(
  spec: CliSpec,
  source: NodeJS.ProcessEnv = process.env,
): Promise<ProviderStatus> {
  const base = {
    id: spec.id,
    name: spec.name,
    transport: "cli" as const,
    capabilities: spec.capabilities,
  };
  const path = await searchPath();
  const command = await resolveCommand(spec.command, path);
  if (!command) {
    return {
      ...base,
      installed: false,
      signedIn: null,
      detail: `\`${spec.command}\` not found on PATH`,
    };
  }
  const env = buildChildEnv(source, { passPrefixes: spec.passEnv, path });
  const [versionOut, auth] = await Promise.all([
    runCommand(command, spec.versionArgs, { env }),
    spec.checkAuth({ command, env }).catch(() => ({ signedIn: null, detail: undefined })),
  ]);
  return {
    ...base,
    installed: true,
    path: command,
    version: VERSION.exec(versionOut.stdout)?.[0],
    signedIn: auth.signedIn,
    detail: auth.detail,
  };
}
