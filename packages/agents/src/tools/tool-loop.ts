import type { JsonSchema, LlmMessage, LlmRequest, ToolDescriptor } from "@agentic/contracts";
import {
  addUsage,
  type CallOptions,
  type CallOutcome,
  callLlm,
  callStructured,
  type LlmProvider,
} from "@agentic/llm";
import { type ToolCall, type Toolset, toolResultMessage } from "@agentic/tools";
import type { agentEventWriter } from "../stream-writer";
import { invokeTool } from "./invoke";
import { toolRound } from "./tool-round";

const MAX_ROUNDS = 24;

export type LoopOutcome = CallOutcome & { attempts: number };

export type ToolLoop = {
  toolset: Toolset | undefined;
  /** Tools called by Agentic, subject to the agent’s approval policy. */
  fenced: readonly ToolDescriptor[];
  cwd: string;
  events: ReturnType<typeof agentEventWriter>;
};

type Request = LlmRequest & { outputSchema?: JsonSchema };

/**
 * Runs each selected tool until the model answers. The agent’s own output
 * schema applies to the final answer over the full exchange.
 */
export async function callWithTools(
  provider: LlmProvider,
  req: Request,
  options: CallOptions & { retries: number },
  loop: ToolLoop,
): Promise<LoopOutcome> {
  const toolset = loop.toolset;
  if (!toolset || loop.fenced.length === 0) return callOnce(provider, req, options);
  const allowed = new Set(loop.fenced.map((t) => t.name));
  const messages: LlmMessage[] = [...req.messages];
  let total: LoopOutcome | undefined;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { outcome, reply } = await toolRound(
      provider,
      { ...req, messages: [...messages] },
      options,
      loop.fenced,
    );
    total = combine(total, outcome);
    if (!outcome.ok) return total;
    messages.push({
      role: "assistant",
      content: outcome.structured === undefined ? outcome.text : JSON.stringify(outcome.structured),
    });
    if (reply.kind === "answer") {
      if (!req.outputSchema) return { ...total, text: reply.text, structured: undefined };
      messages.push({
        role: "user",
        content:
          "Use the tool results above to give the final task output in its required format. Tool selection is finished.",
      });
      const final = await callOnce(provider, { ...req, messages }, options);
      return { ...combine(total, final), text: final.text, structured: final.structured };
    }
    const result =
      reply.kind === "invalid"
        ? { ok: false, value: reply.issue }
        : allowed.has(reply.call.tool)
          ? await run(toolset, loop, reply.call, options.signal)
          : { ok: false, value: `${reply.call.tool} is not one of your tools` };
    const name = reply.kind === "call" ? reply.call.tool : "tool block";
    messages.push({ role: "user", content: toolResultMessage(name, result) });
  }
  return {
    ...(total ?? empty()),
    ok: false,
    error: { code: "tool.loop_limit", message: `Stopped after ${MAX_ROUNDS} tool rounds` },
  };
}

async function run(
  toolset: Toolset,
  loop: ToolLoop,
  call: ToolCall,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; value: unknown }> {
  const outcome = await invokeTool(toolset, call.tool, call.input, loop.cwd, signal, loop.events);
  return outcome.ok ? outcome : { ok: false, value: outcome.error.message };
}

async function callOnce(
  provider: LlmProvider,
  req: Request,
  { retries, ...options }: CallOptions & { retries: number },
): Promise<LoopOutcome> {
  if (!req.outputSchema) return { ...(await callLlm(provider, req, options)), attempts: 1 };
  return callStructured(
    provider,
    { ...req, outputSchema: req.outputSchema },
    { ...options, retries },
  );
}

function combine(a: LoopOutcome | undefined, b: LoopOutcome): LoopOutcome {
  if (!a) return b;
  const costUsd =
    a.costUsd === null && b.costUsd === null ? null : (a.costUsd ?? 0) + (b.costUsd ?? 0);
  return {
    ...b,
    toolCalls: [...a.toolCalls, ...b.toolCalls],
    usage: addUsage(a.usage, b.usage),
    costUsd,
    durationMs: a.durationMs + b.durationMs,
    attempts: a.attempts + b.attempts,
  };
}

const empty = (): LoopOutcome => ({
  ok: false,
  text: "",
  toolCalls: [],
  costUsd: null,
  durationMs: 0,
  attempts: 0,
});
