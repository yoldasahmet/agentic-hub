import {
  type McpServerInput,
  mcpServerSchema,
  mcpTestResultSchema,
  type SkillInput,
  skillSchema,
  type ToolGuardrails,
  toolCatalogSchema,
  toolDescriptorSchema,
  toolGuardrailsSchema,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

const okSchema = z.object({ ok: z.literal(true) });
const previewSchema = z.object({ slug: z.string(), name: z.string(), content: z.string() });

/** The tool catalog and guardrails (`/tools`), MCP servers (`/mcp`), and skills (`/skills`). */
export function createToolsClient(api: Api) {
  const server = api.mcp.servers[":serverId"];
  const serverParam = (serverId: string) => ({ param: { serverId } });
  const skill = api.skills[":skillId"];
  const skillParam = (skillId: string) => ({ param: { skillId } });
  return {
    catalog: async () => parseResponse(await api.tools.$get(), toolCatalogSchema),
    guardrails: async () => parseResponse(await api.tools.guardrails.$get(), toolGuardrailsSchema),
    setGuardrails: async (json: ToolGuardrails) =>
      parseResponse(await api.tools.guardrails.$put({ json }), toolGuardrailsSchema),
    mcp: {
      list: async () => parseResponse(await api.mcp.servers.$get(), z.array(mcpServerSchema)),
      create: async (json: McpServerInput) =>
        parseResponse(await api.mcp.servers.$post({ json }), mcpServerSchema),
      update: async (id: string, json: McpServerInput) =>
        parseResponse(await server.$put({ ...serverParam(id), json }), mcpServerSchema),
      remove: async (id: string) => parseResponse(await server.$delete(serverParam(id)), okSchema),
      test: async (id: string) =>
        parseResponse(await server.test.$post(serverParam(id)), mcpTestResultSchema),
      tools: async (id: string) =>
        parseResponse(await server.tools.$get(serverParam(id)), z.array(toolDescriptorSchema)),
    },
    skills: {
      list: async () => parseResponse(await api.skills.$get(), z.array(skillSchema)),
      create: async (json: SkillInput) =>
        parseResponse(await api.skills.$post({ json }), skillSchema),
      update: async (id: string, json: SkillInput) =>
        parseResponse(await skill.$put({ ...skillParam(id), json }), skillSchema),
      remove: async (id: string) => parseResponse(await skill.$delete(skillParam(id)), okSchema),
      preview: async (id: string) =>
        parseResponse(await skill.preview.$get(skillParam(id)), previewSchema),
    },
  };
}
