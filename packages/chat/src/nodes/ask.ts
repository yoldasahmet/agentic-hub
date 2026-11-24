import { AppError, type ChatInputsRequest, chatInputsAnswerSchema } from "@agentic/contracts";
import { Command, END, interrupt } from "@langchain/langgraph";
import type { ChatDeps } from "../deps";
import { assistantMessage } from "../messages";
import { CHAT_NODES, type ChatTurn, type ChatValues } from "../state";
import { routeTurn } from "./route";

/**
 * Asks for the missing inputs with an inline form (an interrupt). The
 * answer is the filled form, a new message (read again by intake), or a
 * cancel. The node runs again from the top on resume, so nothing before
 * `interrupt` has side effects.
 */
export function askNode(deps: ChatDeps) {
  return async (state: ChatValues): Promise<Command> => {
    const turn = requireTurn(state.turn);
    const target = await deps.targets.resolve(turn.target, state.context.workspaceId);
    const request: ChatInputsRequest = {
      kind: "chat.inputs",
      target: target.ref,
      schema: target.inputSchema,
      values: turn.inputs,
      issues: turn.issues,
    };
    const answer = chatInputsAnswerSchema.safeParse(interrupt(request));
    if (!answer.success) {
      return new Command({
        update: { turn: { ...turn, issues: ["That answer wasn't understood; fill in the form"] } },
        goto: CHAT_NODES.ask,
      });
    }
    switch (answer.data.kind) {
      case "inputs":
        return routeTurn(target, { ...turn, inputs: { ...turn.inputs, ...answer.data.values } });
      case "message":
        return new Command({
          update: { messages: [answer.data.message] },
          goto: CHAT_NODES.intake,
        });
      case "cancel":
        return new Command({
          update: { messages: [assistantMessage({ text: "Canceled.", target: target.ref })] },
          goto: END,
        });
    }
  };
}

export function requireTurn(turn: ChatTurn | null): ChatTurn {
  if (!turn) throw new AppError("internal", "The chat turn has no target");
  return turn;
}
