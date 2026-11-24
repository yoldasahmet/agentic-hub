import type {
  AgentRunReport,
  ChatTarget,
  ChatTargetRef,
  JsonSchema,
  JsonValue,
  ModelPricing,
  ModelRef,
  OutputFormat,
} from "@agentic/contracts";
import type { ProviderRegistry } from "@agentic/llm";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export type TargetResult = { output: Record<string, unknown>; report?: AgentRunReport };

/**
 * An agent or workflow, ready to run inside a chat turn. `run` invokes its
 * graph as a subgraph of the chat thread, so its gates pause the chat run
 * and resume where they left off.
 */
export type ChatTargetDefinition = {
  ref: ChatTargetRef;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  outputFormat: OutputFormat;
  /** The target's own model (agents), used to read inputs from messages. */
  model?: ModelRef;
  run(
    inputs: Record<string, JsonValue>,
    options: { model?: ModelRef; workingDir: string | null },
    config: LangGraphRunnableConfig,
  ): Promise<TargetResult>;
};

/** An agent or workflow the App can find and run. */
export type CatalogEntry = {
  kind: "agent" | "workflow";
  id: string;
  name: string;
  slug: string;
  description: string;
  /** `name*: type` per input field (* = required). */
  inputs: string[];
};

/** Loads targets from the host's modules (Core). Every lookup is scoped to `workspaceId`. */
export interface ChatTargets {
  resolve(
    target: Exclude<ChatTarget, { kind: "app" }>,
    workspaceId: string,
  ): Promise<ChatTargetDefinition>;
  catalog(workspaceId: string): Promise<CatalogEntry[]>;
}

/**
 * A tool the App assistant can call. Built-ins find and run agents and
 * workflows; GitHub and Jira register read tools in P10.4 and P11.4.
 */
export type AppTool = {
  name: string;
  description: string;
  /** One line per parameter, shown to the model. */
  parameters: string;
  run(input: Record<string, unknown>, ctx: { workspaceId: string }): Promise<unknown>;
};

export type ChatDeps = {
  providers: ProviderRegistry;
  pricing(ref: ModelRef): Promise<ModelPricing | undefined>;
  /** The workspace's default model, for the App and for reading inputs. */
  defaultModel(workspaceId: string): Promise<ModelRef | undefined>;
  targets: ChatTargets;
  tools: AppTool[];
  /** Where App calls run their CLI when the chat has no working dir. */
  scratchDir: string;
};
