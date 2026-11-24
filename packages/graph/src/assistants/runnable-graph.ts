import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseCheckpointSaver, BaseStore, StateSnapshot } from "@langchain/langgraph";

export type StreamMode = "updates" | "messages" | "custom" | "values";

/**
 * The slice of a compiled LangGraph graph that the runtime uses. Any
 * `StateGraph(...).compile({ checkpointer, store })` satisfies it.
 */
export interface RunnableGraph {
  stream(
    input: unknown,
    options: RunnableConfig & { streamMode: StreamMode[]; signal?: AbortSignal },
  ): Promise<AsyncIterable<unknown>>;
  getState(config: RunnableConfig): Promise<StateSnapshot>;
  getStateHistory(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig },
  ): AsyncIterableIterator<StateSnapshot>;
  updateState(
    config: RunnableConfig,
    values: Record<string, unknown>,
    asNode?: string,
  ): Promise<RunnableConfig>;
}

export type GraphDeps = { checkpointer: BaseCheckpointSaver; store: BaseStore };
