import type { AgentSpec } from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { toAgent, toAgentVersion } from "./mappers";
import type { AgentRepository } from "./repository";

export type AgentSummary = ReturnType<typeof toAgent> & {
  workspaceId: string;
  archived: boolean;
};

/**
 * Read access to agents for other modules (workflows, chats), so they never touch
 * the agents repository. `find` and `spec` are unscoped for the job worker,
 * which serves every workspace; callers check `workspaceId`.
 */
export class AgentDirectory {
  constructor(private readonly repo: AgentRepository) {}

  async find(id: string): Promise<AgentSummary | undefined> {
    const row = await this.repo.getById(id);
    if (!row) return undefined;
    return { ...toAgent(row), workspaceId: row.workspaceId, archived: row.archivedAt !== null };
  }

  /** A published version's spec. Versions are immutable, so the result can be cached. */
  async spec(id: string, version: number): Promise<AgentSpec | undefined> {
    const row = await this.repo.getVersion(id, version);
    return row ? toAgentVersion(row).spec : undefined;
  }

  async published(workspaceId: string): Promise<AgentSummary[]> {
    const rows = await this.repo.listPublished(workspaceId);
    return rows.map((row) => ({ ...toAgent(row), workspaceId: row.workspaceId, archived: false }));
  }

  async bySlug(ctx: LocalContext, slug: string) {
    const rows = await this.repo.list(ctx, false);
    const row = rows.find((r) => r.slug === slug);
    return row ? toAgent(row) : undefined;
  }
}
