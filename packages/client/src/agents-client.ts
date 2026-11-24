import {
  type AgentTestInput,
  agentExportSchema,
  agentSchema,
  agentTestInputsSchema,
  agentVersionSchema,
  type BundleFormat,
  builtinAgentSchema,
  type CreateAgentInput,
  type ImportAgentInput,
  type RunAgentInput,
  runSchema,
  type UpdateAgentInput,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

/** Agents, their versions and runs, and the library (`/agents`). */
export function createAgentsClient(api: Api) {
  const agent = api.agents[":agentId"];
  const param = (agentId: string) => ({ param: { agentId } });
  return {
    list: async (archived = false) =>
      parseResponse(
        await api.agents.$get({ query: { archived: archived ? "1" : "0" } }),
        z.array(agentSchema),
      ),
    get: async (agentId: string) => parseResponse(await agent.$get(param(agentId)), agentSchema),
    create: async (json: CreateAgentInput) =>
      parseResponse(await api.agents.$post({ json }), agentSchema),
    update: async (agentId: string, json: UpdateAgentInput) =>
      parseResponse(await agent.$patch({ ...param(agentId), json }), agentSchema),
    setArchived: async (agentId: string, archived: boolean) =>
      parseResponse(
        await agent.archive.$post({ ...param(agentId), json: { archived } }),
        agentSchema,
      ),
    duplicate: async (agentId: string) =>
      parseResponse(await agent.duplicate.$post(param(agentId)), agentSchema),
    publish: async (agentId: string, revision: number) =>
      parseResponse(
        await agent.publish.$post({ ...param(agentId), json: { revision } }),
        agentVersionSchema,
      ),
    versions: async (agentId: string) =>
      parseResponse(await agent.versions.$get(param(agentId)), z.array(agentVersionSchema)),
    run: async (agentId: string, json: RunAgentInput) =>
      parseResponse(await agent.runs.$post({ ...param(agentId), json }), runSchema),
    testInputs: async (agentId: string) =>
      parseResponse(await agent["test-inputs"].$get(param(agentId)), agentTestInputsSchema),
    setTestInputs: async (agentId: string, json: AgentTestInput[]) =>
      parseResponse(
        await agent["test-inputs"].$put({ ...param(agentId), json }),
        agentTestInputsSchema,
      ),
    export: async (agentId: string, format: BundleFormat) =>
      parseResponse(
        await agent.export.$get({ ...param(agentId), query: { format } }),
        agentExportSchema,
      ),
    import: async (json: ImportAgentInput) =>
      parseResponse(await api.agents.import.$post({ json }), agentSchema),
    builtins: async () =>
      parseResponse(await api.agents.builtins.$get(), z.array(builtinAgentSchema)),
    installBuiltin: async (slug: string) =>
      parseResponse(
        await api.agents.builtins[":slug"].install.$post({ param: { slug } }),
        agentSchema,
      ),
  };
}
