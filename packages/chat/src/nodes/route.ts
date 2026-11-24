import { Command } from "@langchain/langgraph";
import type { ChatTargetDefinition } from "../deps";
import { inputIssues } from "../intake/check-inputs";
import { CHAT_NODES, type ChatTurn, type ChatUpdate } from "../state";

/** Runs the target when its inputs are complete; otherwise asks for the rest. */
export function routeTurn(
  target: ChatTargetDefinition,
  turn: ChatTurn,
  update: ChatUpdate = {},
): Command {
  const issues = inputIssues(target.inputSchema, turn.inputs);
  return new Command({
    update: { ...update, turn: { ...turn, issues } },
    goto: issues.length > 0 ? CHAT_NODES.ask : CHAT_NODES.execute,
  });
}
