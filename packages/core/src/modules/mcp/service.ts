import {
  AppError,
  type McpServer,
  type McpServerInput,
  type McpTestResult,
  mcpServerInputSchema,
  type ToolDescriptor,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { McpPool, McpServerEntry } from "@agentic/tools";
import { toLaunch, toMcpServer } from "./mappers";
import type { McpServerRepository } from "./repository";

/** MCP servers: CRUD, a connection test, their tools, and launches for the toolbox. */
export class McpService {
  constructor(
    private readonly repo: McpServerRepository,
    private readonly pool: McpPool,
    private readonly secret: (name: string) => string | undefined,
  ) {}

  async list(ctx: LocalContext): Promise<McpServer[]> {
    return (await this.repo.list(ctx.workspaceId)).map(toMcpServer);
  }

  async create(ctx: LocalContext, input: McpServerInput): Promise<McpServer> {
    const { name, enabled, config } = mcpServerInputSchema.parse(input);
    const row = await this.repo.insert(ctx, { name, enabled, transport: config.transport, config });
    return toMcpServer(row);
  }

  async update(ctx: LocalContext, id: string, input: McpServerInput): Promise<McpServer> {
    const { name, enabled, config } = mcpServerInputSchema.parse(input);
    const clash = (await this.repo.list(ctx.workspaceId)).find(
      (r) => r.name === name && r.id !== id,
    );
    if (clash) throw new AppError("conflict", `An MCP server named ${name} already exists`);
    const row = await this.repo.update(ctx, id, {
      name,
      enabled,
      transport: config.transport,
      config,
    });
    await this.pool.drop(id);
    return toMcpServer(row);
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.repo.remove(ctx, id);
    await this.pool.drop(id);
  }

  /** Connects fresh and lists the tools; failures are a result, not an error, for the UI. */
  async test(ctx: LocalContext, id: string): Promise<McpTestResult> {
    try {
      const server = toMcpServer(await this.repo.get(ctx, id));
      return { ok: true, tools: await this.pool.test(toLaunch(server, this.secret)) };
    } catch (err) {
      return { ok: false, tools: [], error: AppError.from(err).toJSON() };
    }
  }

  async tools(ctx: LocalContext, id: string): Promise<ToolDescriptor[]> {
    const server = toMcpServer(await this.repo.get(ctx, id));
    return this.pool.tools(server.id, toLaunch(server, this.secret));
  }

  toolsOf(entry: McpServerEntry): Promise<ToolDescriptor[]> {
    return this.pool.tools(entry.id, entry.launch);
  }

  /** Enabled servers by name, for the toolbox. */
  async entries(workspaceId: string, names: readonly string[]): Promise<McpServerEntry[]> {
    const rows = await this.repo.byNames(workspaceId, names);
    return rows.map(toMcpServer).map((s) => ({ id: s.id, launch: toLaunch(s, this.secret) }));
  }

  /** Every enabled server's name, for the catalog. */
  async enabledNames(workspaceId: string): Promise<string[]> {
    return (await this.repo.list(workspaceId)).filter((r) => r.enabled).map((r) => r.name);
  }
}
