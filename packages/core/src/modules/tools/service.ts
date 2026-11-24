import { AppError, type ToolCatalog, type ToolGuardrails } from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { ToolRegistry } from "@agentic/tools";
import type { McpService } from "../mcp/service";
import type { GuardrailsRepository } from "./guardrails-repository";

/** The tool catalog (built-ins + enabled MCP servers) and the workspace guardrails. */
export class ToolService {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly mcp: McpService,
    private readonly guardrailsRepo: GuardrailsRepository,
  ) {}

  /** A server that can't be reached is reported, not fatal, so the rest still lists. */
  async catalog(ctx: LocalContext): Promise<ToolCatalog> {
    const names = await this.mcp.enabledNames(ctx.workspaceId);
    const servers = await Promise.all(
      names.map(async (name) => {
        try {
          const [entry] = await this.mcp.entries(ctx.workspaceId, [name]);
          if (!entry) return { name, ok: false, tools: [], error: "Not found" };
          return { name, ok: true, tools: await this.mcp.toolsOf(entry) };
        } catch (err) {
          return { name, ok: false, tools: [], error: AppError.from(err).message };
        }
      }),
    );
    return {
      tools: [...this.registry.list(), ...servers.flatMap((s) => s.tools)],
      servers: servers.map(({ name, ok, error }) => ({ name, ok, error })),
    };
  }

  guardrails(ctx: LocalContext): Promise<ToolGuardrails> {
    return this.guardrailsRepo.get(ctx.workspaceId);
  }

  async setGuardrails(ctx: LocalContext, value: ToolGuardrails): Promise<ToolGuardrails> {
    await this.guardrailsRepo.set(ctx, value);
    return value;
  }
}
