import { agentEventWriter } from "@agentic/agents";
import {
  type AgentRunReport,
  type ChatTargetRef,
  type LlmMessage,
  newId,
  PRODUCT_NAME,
} from "@agentic/contracts";
import { callLlm } from "@agentic/llm";
import { Command, END, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { findTool } from "../app/find-tool";
import { parseReply } from "../app/protocol";
import { addCall, emptyReport } from "../app/report";
import { readRunCall } from "../app/run-call";
import { appSystemPrompt } from "../app/system-prompt";
import type { AppTool, ChatDeps } from "../deps";
import { announce } from "../events";
import { knownInputs } from "../intake/check-inputs";
import { assistantMessage } from "../messages";
import { clip, conversation } from "../prompt/history";
import type { ChatUpdate, ChatValues } from "../state";
import { routeTurn } from "./route";

export const APP_REF: ChatTargetRef = { kind: "app", id: null, version: null, name: PRODUCT_NAME };

/** Tool rounds per message before the App has to answer. */
const MAX_ROUNDS = 5;

/**
 * The App target: a general assistant on the chat's model. It answers, or
 * calls a tool (find, GitHub/Jira reads later) and continues with the
 * result, or hands the turn to an agent or workflow with `run`, whose
 * inputs then go through the same ask → execute → respond path.
 */
export function appNode(deps: ChatDeps) {
  const tools: AppTool[] = [findTool(deps.targets), ...deps.tools];
  return async (state: ChatValues, config: LangGraphRunnableConfig): Promise<Command> => {
    const { context } = state;
    const done = (update: ChatUpdate) => new Command({ update, goto: END });
    const model = context.model ?? (await deps.defaultModel(context.workspaceId));
    if (!model) {
      const error = {
        code: "validation_failed",
        message: "Choose a model for this chat, or enable one in Settings → Providers",
      };
      return done({ messages: [assistantMessage({ text: "", target: APP_REF, error })] });
    }
    announce(config, "app", "Thinking");
    const catalog = await deps.targets.catalog(context.workspaceId);
    const system = appSystemPrompt(catalog, tools);
    const history = await conversation(state.messages);
    const provider = deps.providers.get(model.providerId);
    const pricing = await deps.pricing(model);
    const events = agentEventWriter(config.writer);
    const cwd = context.workingDir ?? deps.scratchDir;
    const scratch: LlmMessage[] = [];
    let report: AgentRunReport = emptyReport(model);
    events.attempt(model, 1);

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const outcome = await callLlm(
        provider,
        { model: model.model, system, messages: [...history, ...scratch], cwd },
        { signal: config.signal, pricing, onEvent: events.llm },
      );
      events.flush();
      report = addCall(report, outcome);
      if (!outcome.ok) {
        const error = outcome.error ?? { code: "llm.failed", message: "The model call failed" };
        return done({ messages: [assistantMessage({ text: "", target: APP_REF, report, error })] });
      }
      const reply = parseReply(outcome.text);
      if (reply.kind === "answer") {
        return done({
          messages: [assistantMessage({ text: reply.text, target: APP_REF, report })],
        });
      }
      const said = reply.before
        ? [assistantMessage({ text: reply.before, target: APP_REF, report })]
        : [];
      let result: unknown;
      if (reply.kind === "invalid") {
        result = { error: reply.issue };
      } else if (reply.call.tool === "run") {
        const call = readRunCall(reply.call.input, catalog);
        if (call.ok) {
          const target = await deps.targets.resolve(call.run.target, context.workspaceId);
          const inputs = knownInputs(target.inputSchema, call.run.inputs);
          return routeTurn(
            target,
            { target: call.run.target, inputs, issues: [] },
            { messages: said },
          );
        }
        result = { error: call.issue };
      } else {
        result = await callTool(tools, reply.call.tool, reply.call.input, context.workspaceId);
      }
      const id = newId();
      const name = reply.kind === "call" ? reply.call.tool : "tool";
      announce(config, "tool", `Used ${name}`);
      events.llm({
        type: "tool_call",
        id,
        name,
        input: reply.kind === "call" ? reply.call.input : {},
      });
      events.llm({ type: "tool_result", id, output: result, isError: isError(result) });
      scratch.push(
        { role: "assistant", content: outcome.text },
        {
          role: "user",
          content: `Result of ${name}:\n${clip(JSON.stringify(result, null, 2), 8000)}`,
        },
      );
    }
    const text = `I stopped after ${MAX_ROUNDS} tool calls without an answer. Try asking more specifically.`;
    return done({ messages: [assistantMessage({ text, target: APP_REF, report })] });
  };
}

async function callTool(
  tools: AppTool[],
  name: string,
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { error: `There is no tool named ${name}` };
  try {
    return await tool.run(input, { workspaceId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const isError = (result: unknown) =>
  result !== null && typeof result === "object" && "error" in result;
