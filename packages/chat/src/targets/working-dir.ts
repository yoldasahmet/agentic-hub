import type { AgentSpec } from "@agentic/contracts";

/** A chat's working dir wins over the agent's own policy, so a chat can point agents at a repo. */
export function withWorkingDir(spec: AgentSpec, workingDir: string | null): AgentSpec {
  if (!workingDir) return spec;
  return { ...spec, runtime: { ...spec.runtime, workingDir: { mode: "fixed", path: workingDir } } };
}
