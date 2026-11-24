import type { ChatDeps } from "../deps";
import { assistantMessage } from "../messages";
import type { ChatUpdate, ChatValues } from "../state";
import { requireTurn } from "./ask";

/** Answers with the target's output, rendered by its format, or with its error. */
export function respondNode(deps: ChatDeps) {
  return async (state: ChatValues): Promise<ChatUpdate> => {
    const turn = requireTurn(state.turn);
    const { ref, result, error, inputs } = turn;
    if (!result) return { messages: [assistantMessage({ text: "", target: ref, inputs, error })] };
    const target = await deps.targets.resolve(turn.target, state.context.workspaceId);
    const text = typeof result.output.text === "string" ? result.output.text : "";
    const output = {
      format: target.outputFormat,
      value: result.output,
      schema: target.outputSchema,
    };
    return {
      messages: [assistantMessage({ text, target: ref, inputs, output, report: result.report })],
    };
  };
}
