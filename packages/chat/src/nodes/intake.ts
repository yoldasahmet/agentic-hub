import { AppError } from "@agentic/contracts";
import { Command, type LangGraphRunnableConfig } from "@langchain/langgraph";
import type { ChatDeps } from "../deps";
import { announce } from "../events";
import { extractInputs } from "../intake/extract-inputs";
import { lastResultOf, lastUserMessage } from "../messages";
import { messageText } from "../prompt/attachments";
import { CHAT_NODES, type ChatValues } from "../state";
import { routeTurn } from "./route";

/**
 * The first step of every message: the App answers itself; an agent or
 * workflow gets its inputs read from the conversation, refining the last
 * answer's inputs on a follow-up, then runs or asks for what is missing.
 */
export function intakeNode(deps: ChatDeps) {
  return async (state: ChatValues, config: LangGraphRunnableConfig): Promise<Command> => {
    const { context } = state;
    const target = state.turn?.target ?? (context.target.kind === "app" ? null : context.target);
    if (!target) return new Command({ goto: CHAT_NODES.app });

    const definition = await deps.targets.resolve(target, context.workspaceId);
    const latest = lastUserMessage(state.messages);
    if (!latest) throw new AppError("validation_failed", "This chat has no message to answer");
    announce(config, "intake", `Reading the inputs for ${definition.ref.name}`);

    const previous = state.turn ? undefined : lastResultOf(state.messages, target.id);
    const model =
      (target.kind === "agent" ? context.model : null) ??
      definition.model ??
      context.model ??
      (await deps.defaultModel(context.workspaceId));
    const inputs = await extractInputs(
      {
        target: definition,
        messages: state.messages,
        latest: await messageText(latest),
        current: state.turn?.inputs ?? previous?.inputs ?? {},
        previous,
        model: model ?? undefined,
        cwd: context.workingDir ?? deps.scratchDir,
        signal: config.signal,
      },
      deps,
    );
    return routeTurn(definition, { target, inputs, issues: [] });
  };
}
