import type {
  AppErrorShape,
  ChatContext,
  ChatMessage,
  ChatTarget,
  ChatTargetRef,
  JsonValue,
} from "@agentic/contracts";
import { Annotation } from "@langchain/langgraph";
import type { TargetResult } from "./deps";

/** Messages merge by id, so a step can rewrite one it already wrote. */
const mergeMessages = (current: ChatMessage[], update: ChatMessage[]) => {
  const next = [...current];
  for (const message of update) {
    const index = next.findIndex((m) => m.id === message.id);
    if (index === -1) next.push(message);
    else next[index] = message;
  }
  return next;
};

/**
 * One turn's work in progress: which target answers, the inputs gathered
 * so far, and (after execute) its result or error for respond.
 */
export type ChatTurn = {
  target: Exclude<ChatTarget, { kind: "app" }>;
  inputs: Record<string, JsonValue>;
  issues: string[];
  ref?: ChatTargetRef;
  result?: TargetResult;
  error?: AppErrorShape;
};

/**
 * The state of a chat thread. Each message starts a run whose input is
 * `{ messages: [message], context, turn: null }`:
 * - `messages`: the whole conversation (the source of truth for the UI);
 * - `context`: the chat's target, model, and working dir when it was sent;
 * - `turn`: the current turn's target and inputs, reset by each message.
 */
export const ChatState = Annotation.Root({
  messages: Annotation<ChatMessage[]>({ reducer: mergeMessages, default: () => [] }),
  context: Annotation<ChatContext>(),
  turn: Annotation<ChatTurn | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});
export type ChatValues = typeof ChatState.State;
export type ChatUpdate = typeof ChatState.Update;

export const CHAT_NODES = {
  intake: "intake",
  ask: "ask",
  execute: "execute",
  respond: "respond",
  app: "app",
} as const;
