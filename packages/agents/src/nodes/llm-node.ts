import {
  type AgentRunReport,
  type AgentSpec,
  AppError,
  type AppErrorShape,
  type ModelRef,
} from "@agentic/contracts";
import { addUsage, type CallOutcome } from "@agentic/llm";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentStateUpdate } from "../agent-state";
import type { AgentRuntimeDeps } from "../deps";
import { buildRequest } from "../request";
import { agentEventWriter } from "../stream-writer";
import { type PreparedTools, prepareTools, toolsFor } from "../tools/prepare";
import { callWithTools } from "../tools/tool-loop";
import { resolveWorkingDir } from "../working-dir";

/** Invalid answers are repaired by the same model; trying another one wouldn't fix the prompt. */
const NO_FALLBACK_CODES = new Set(["llm.output_invalid", "validation_failed"]);

/**
 * The `llm` kind: render, call, validate, repair. A run-level model
 * override replaces the configured model and its fallbacks, so the
 * playground compares exactly the provider it picked.
 */
export async function runLlmAgent(
  spec: AgentSpec,
  input: Record<string, unknown>,
  override: ModelRef | undefined,
  deps: AgentRuntimeDeps,
  config: LangGraphRunnableConfig,
): Promise<AgentStateUpdate> {
  const models = override
    ? [override]
    : [spec.runtime.model, ...spec.runtime.fallbacks].filter((m) => m !== undefined);
  if (models.length === 0) {
    throw new AppError("validation_failed", "Choose a model for this agent before running it");
  }
  const cwd = await resolveWorkingDir(spec.runtime.workingDir, input, deps, config);
  const tools = await prepareTools(spec, cwd, deps, config);
  const events = agentEventWriter(config.writer);
  let report: AgentRunReport = { costUsd: null, durationMs: 0, attempts: 0 };
  let lastError: AppErrorShape | undefined;

  for (const [index, ref] of models.entries()) {
    events.attempt(ref, index + 1);
    const call = { ref, cwd, tools, signal: config.signal, events };
    const outcome = await callModel(spec, input, deps, call);
    events.flush();
    report = merge(report, ref, outcome);
    if (outcome.ok) {
      const raw = isRecord(outcome.structured) ? outcome.structured : { text: outcome.text };
      return { output: tools ? tools.toolset.mask(raw) : raw, report };
    }
    lastError = outcome.error;
    if (config.signal?.aborted || NO_FALLBACK_CODES.has(lastError?.code ?? "")) break;
  }
  throw new AppError(
    lastError?.code ?? "llm.failed",
    lastError?.message ?? "The model call failed",
    lastError?.details,
  );
}

type ModelCall = {
  ref: ModelRef;
  cwd: string;
  tools: PreparedTools | undefined;
  signal: AbortSignal | undefined;
  events: ReturnType<typeof agentEventWriter>;
};

async function callModel(
  spec: AgentSpec,
  input: Record<string, unknown>,
  deps: AgentRuntimeDeps,
  { ref, cwd, tools, signal, events }: ModelCall,
): Promise<CallOutcome & { attempts?: number }> {
  const provider = deps.providers.get(ref.providerId);
  const req = buildRequest(spec, input, ref.model, cwd);
  const own = toolsFor(tools, provider);
  const system = [req.system, own.system].filter(Boolean).join("\n\n") || undefined;
  const options = {
    signal,
    onEvent: events.llm,
    pricing: await deps.pricing(ref),
    extras: own.extras,
    retries: spec.runtime.maxRepairs,
  };
  return callWithTools(provider, { ...req, system }, options, {
    toolset: tools?.toolset,
    fenced: own.fenced,
    cwd,
    events,
  });
}

function merge(
  report: AgentRunReport,
  model: ModelRef,
  outcome: CallOutcome & { attempts?: number },
): AgentRunReport {
  const costUsd =
    report.costUsd === null && outcome.costUsd === null
      ? null
      : (report.costUsd ?? 0) + (outcome.costUsd ?? 0);
  return {
    model,
    usage: addUsage(report.usage, outcome.usage),
    costUsd,
    durationMs: report.durationMs + outcome.durationMs,
    attempts: report.attempts + (outcome.attempts ?? 1),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
