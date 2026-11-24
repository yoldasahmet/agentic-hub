import type { ModelPricing, ModelRef } from "@agentic/contracts";
import type { ProviderRegistry } from "@agentic/llm";
import type { Toolbox } from "@agentic/tools";

/** What agent nodes need from the host (Core): providers, prices, a scratch dir, and tools. */
export type AgentRuntimeDeps = {
  providers: ProviderRegistry;
  pricing(ref: ModelRef): Promise<ModelPricing | undefined>;
  /** A neutral working dir for the `scratch` policy. */
  scratchDir: string;
  /** Resolves an agent's tool, MCP, and skill slots for a run (packages/tools). */
  tools: Toolbox;
  /** Git worktrees for the `worktree` policy; absent hosts reject that policy. */
  worktrees?: WorktreeProvider;
};

/** One worktree per run and repo (`owner/name` or a local repo path), shared by its nodes. */
export type WorktreeProvider = {
  forRun(req: {
    workspaceId: string;
    runId: string;
    repo: string;
    signal?: AbortSignal;
  }): Promise<string>;
};
