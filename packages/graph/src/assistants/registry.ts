import { AppError, type Assistant, type AssistantId } from "@agentic/contracts";
import type { GraphDeps, RunnableGraph } from "./runnable-graph";

/** A graph Core can run. */
export type AssistantDefinition = Assistant & {
  build(deps: GraphDeps): RunnableGraph;
};

/**
 * Assistants stored as data (agents, later workflows), resolved on demand.
 * Reading from the DB on each miss keeps every app instance on a shared
 * team DB in sync without broadcasting registrations.
 */
export interface AssistantSource {
  matches(id: AssistantId): boolean;
  /** The version new runs use. `workspaceId` scopes the lookup to the caller's workspace. */
  latest(id: AssistantId, workspaceId: string): Promise<Assistant>;
  definition(id: AssistantId, version: number): Promise<AssistantDefinition>;
}

/** Compiled versions are immutable, so the cache only needs a size bound. */
const MAX_COMPILED = 256;

/**
 * The assistant registry: graph id → builder, pinned by version. Built-in
 * graphs register directly; sources resolve the rest. Runs look up the
 * exact version they started on.
 */
export class AssistantRegistry {
  private readonly definitions = new Map<string, AssistantDefinition>();
  private readonly sources: AssistantSource[] = [];
  private readonly compiled = new Map<string, RunnableGraph>();
  private deps: GraphDeps | undefined;

  register(definition: AssistantDefinition): void {
    this.definitions.set(key(definition.id, definition.version), definition);
    const latest = this.definitions.get(definition.id);
    if (!latest || latest.version < definition.version) {
      this.definitions.set(definition.id, definition);
    }
  }

  addSource(source: AssistantSource): void {
    this.sources.push(source);
  }

  /** Called once the checkpointer and store exist. */
  attach(deps: GraphDeps): void {
    this.deps = deps;
    this.compiled.clear();
  }

  /** The built-in assistants. Sourced ones are listed by their own modules (e.g. /agents). */
  list(): Assistant[] {
    return [...this.definitions.entries()]
      .filter(([k]) => !k.includes("#"))
      .map(([, definition]) => describe(definition));
  }

  /** The latest version, for new runs in `workspaceId`. */
  async latest(id: AssistantId, workspaceId: string): Promise<Assistant> {
    const definition = this.definitions.get(id);
    if (definition) return describe(definition);
    const source = this.sources.find((s) => s.matches(id));
    if (!source) throw new AppError("not_found", `Unknown assistant ${id}`);
    return source.latest(id, workspaceId);
  }

  async graph(id: AssistantId, version: number): Promise<RunnableGraph> {
    const k = key(id, version);
    const cached = this.compiled.get(k);
    if (cached) return cached;
    const definition = this.definitions.get(k) ?? (await this.resolve(id, version));
    if (!this.deps) throw new AppError("unavailable", "Graph storage is not ready");
    const graph = definition.build(this.deps);
    if (this.compiled.size >= MAX_COMPILED) this.compiled.clear();
    this.compiled.set(k, graph);
    return graph;
  }

  private resolve(id: AssistantId, version: number): Promise<AssistantDefinition> {
    const source = this.sources.find((s) => s.matches(id));
    if (!source) throw new AppError("not_found", `Assistant ${id} has no version ${version}`);
    return source.definition(id, version);
  }
}

const key = (id: string, version: number) => `${id}#${version}`;

function describe({ id, name, description, version, nodes }: AssistantDefinition): Assistant {
  return { id, name, description, version, nodes };
}
