import { AppError, type ChatTargetRef } from "@agentic/contracts";
import { isGraphBubbleUp, type LangGraphRunnableConfig } from "@langchain/langgraph";
import type { ChatDeps } from "../deps";
import { announce } from "../events";
import type { ChatUpdate, ChatValues } from "../state";
import { requireTurn } from "./ask";

/**
 * Runs the target as a subgraph of the chat thread. A gate inside pauses
 * the chat run (the interrupt bubbles up) and this node runs again on
 * resume, continuing the subgraph. A failure is kept for respond, so the
 * chat answers with what went wrong and can go on.
 */
export function executeNode(deps: ChatDeps) {
  return async (state: ChatValues, config: LangGraphRunnableConfig): Promise<ChatUpdate> => {
    const { context } = state;
    const turn = requireTurn(state.turn);
    let ref: ChatTargetRef = { ...turn.target, version: null, name: "This target" };
    try {
      const target = await deps.targets.resolve(turn.target, context.workspaceId);
      ref = target.ref;
      announce(config, "execute", `Running ${target.ref.name}`);
      const model = turn.target.kind === "agent" ? (context.model ?? undefined) : undefined;
      const result = await target.run(
        turn.inputs,
        { model, workingDir: context.workingDir },
        config,
      );
      return { turn: { ...turn, ref, result } };
    } catch (err) {
      if (isGraphBubbleUp(err) || config.signal?.aborted) throw err;
      return { turn: { ...turn, ref, error: AppError.from(err).toJSON() } };
    }
  };
}
