import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Annotation, END, interrupt, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import type { AssistantDefinition } from "./registry";

/**
 * A small built-in graph that exercises the runtime before agents exist:
 * a node, a custom event, a human gate (`interrupt`), and a final node.
 * `delayMs` slows the first node so cancel and restart recovery can be tried.
 */
const SampleState = Annotation.Root({
  topic: Annotation<string>(),
  delayMs: Annotation<number>(),
  draft: Annotation<string>(),
  approved: Annotation<boolean>(),
  note: Annotation<string>(),
  result: Annotation<string>(),
});
type State = typeof SampleState.State;

const reviewAnswerSchema = z.object({
  approved: z.boolean(),
  note: z.string().default(""),
});

async function writeDraft(state: State, config: LangGraphRunnableConfig): Promise<Partial<State>> {
  const topic = state.topic?.trim() || "LangGraph";
  const delayMs = Math.min(Math.max(state.delayMs ?? 0, 0), 600_000);
  config.writer?.({ progress: `Drafting about ${topic}` });
  if (delayMs > 0) await sleep(delayMs, config.signal);
  return { topic, draft: `A short note about ${topic}.` };
}

function review(state: State): Partial<State> {
  const answer = reviewAnswerSchema.parse(
    interrupt({ question: "Approve this draft?", draft: state.draft }),
  );
  return { approved: answer.approved, note: answer.note };
}

function finish(state: State): Partial<State> {
  const verdict = state.approved ? "Approved" : "Rejected";
  return { result: `${verdict}: ${state.draft}${state.note ? ` (${state.note})` : ""}` };
}

export const sampleAssistant: AssistantDefinition = {
  id: "sample",
  name: "Sample graph",
  description: "write → review (human gate) → finish. Input: { topic, delayMs? }",
  version: 1,
  nodes: ["write", "review", "finish"],
  build: ({ checkpointer, store }) =>
    new StateGraph(SampleState)
      .addNode("write", writeDraft)
      .addNode("review", review)
      .addNode("finish", finish)
      .addEdge(START, "write")
      .addEdge("write", "review")
      .addEdge("review", "finish")
      .addEdge("finish", END)
      .compile({ checkpointer, store }),
};

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}
