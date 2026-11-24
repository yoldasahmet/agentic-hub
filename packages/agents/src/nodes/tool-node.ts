import { type AgentSpec, AppError, hasFields } from "@agentic/contracts";
import { checkJsonSchema } from "@agentic/llm";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentStateUpdate } from "../agent-state";
import type { AgentRuntimeDeps } from "../deps";
import { agentEventWriter } from "../stream-writer";
import { approveCall } from "../tools/approval";
import { invokeTool } from "../tools/invoke";
import { resolveWorkingDir } from "../working-dir";
import { workspaceOf } from "../workspace";

/**
 * The `tool` kind: calls the configured tool with the agent's inputs, after
 * the approval policy (and a person, when it asks) agrees. A non-object
 * result is wrapped as `{ result }`; with output fields it must match them.
 */
export async function runToolAgent(
  spec: AgentSpec,
  input: Record<string, unknown>,
  deps: AgentRuntimeDeps,
  config: LangGraphRunnableConfig,
): Promise<AgentStateUpdate> {
  const name = spec.runtime.tool;
  if (!name) throw new AppError("validation_failed", "Choose the tool this agent calls");
  const toolset = await deps.tools.resolve({
    workspaceId: workspaceOf(config),
    tools: [name],
    mcpServers: [],
    skills: [],
  });
  const tool = toolset.tools.find((t) => t.name === name);
  if (!tool) throw new AppError("not_found", `Tool ${name} is not registered`);
  const cwd = await resolveWorkingDir(spec.runtime.workingDir, input, deps, config);
  approveCall(tool, input, spec.capabilities.approval, cwd);

  const started = Date.now();
  const events = agentEventWriter(config.writer);
  const outcome = await invokeTool(toolset, name, input, cwd, config.signal, events);
  if (!outcome.ok) throw outcome.error;
  const result = outcome.value;
  const output =
    result !== null && typeof result === "object" && !Array.isArray(result)
      ? Object.fromEntries(Object.entries(result))
      : { result };
  if (hasFields(spec.outputSchema)) {
    const checked = checkJsonSchema(spec.outputSchema, output);
    if (!checked.ok) {
      throw new AppError("llm.output_invalid", `Tool ${name} returned an unexpected shape`, {
        issues: checked.issues,
      });
    }
  }
  return { output, report: { costUsd: null, durationMs: Date.now() - started, attempts: 1 } };
}
