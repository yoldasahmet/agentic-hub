import type { McpServerInput, SkillInput, ToolGuardrails } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../../lib/core-queries";

export function useToolCatalog() {
  return useCoreQuery(["tools", "catalog"], (client) => client.tools.catalog());
}

export function useGuardrails() {
  return useCoreQuery(["tools", "guardrails"], (client) => client.tools.guardrails());
}

export function useSetGuardrails() {
  return useCoreMutation((client, value: ToolGuardrails) => client.tools.setGuardrails(value));
}

export function useMcpServers() {
  return useCoreQuery(["mcp", "servers"], (client) => client.tools.mcp.list());
}

/** Creates when there is no id, else replaces the server's settings. */
export function useSaveMcpServer() {
  return useCoreMutation((client, input: { id?: string; value: McpServerInput }) =>
    input.id
      ? client.tools.mcp.update(input.id, input.value)
      : client.tools.mcp.create(input.value),
  );
}

export function useDeleteMcpServer() {
  return useCoreMutation((client, id: string) => client.tools.mcp.remove(id));
}

export function useTestMcpServer() {
  return useCoreMutation((client, id: string) => client.tools.mcp.test(id));
}

export function useSkills() {
  return useCoreQuery(["skills"], (client) => client.tools.skills.list());
}

export function useSaveSkill() {
  return useCoreMutation((client, input: { id?: string; value: SkillInput }) =>
    input.id
      ? client.tools.skills.update(input.id, input.value)
      : client.tools.skills.create(input.value),
  );
}

export function useDeleteSkill() {
  return useCoreMutation((client, id: string) => client.tools.skills.remove(id));
}

export function useSkillPreview(id: string | undefined) {
  return useCoreQuery(
    ["skills", id, "preview"],
    (client) => client.tools.skills.preview(id ?? ""),
    Boolean(id),
  );
}
