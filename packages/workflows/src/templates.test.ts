import { builtinAgents, builtinSkills } from "@agentic/agents";
import {
  type AgentBundle,
  newId,
  type WorkflowBundle,
  workflowDocumentSchema,
} from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { type CatalogLookup, catalogKey } from "./catalog";
import { workflowTemplates } from "./templates";
import { validateWorkflow } from "./validate/index";

/** The agent a template node runs: the bundle's own first, as on install. */
function agentFor(bundle: WorkflowBundle, slug: string): AgentBundle | undefined {
  return (
    bundle.agents.find((a) => a.agent.slug === slug) ??
    builtinAgents.find((a) => a.agent.slug === slug)
  );
}

/** The template's document with slugs mapped to ids, and a catalog of those agents. */
function installed(bundle: WorkflowBundle) {
  const ids = new Map<string, string>();
  const agents = new Map<string, CatalogLookup>();
  const nodes = bundle.workflow.document.nodes.map((node) => {
    if (node.kind !== "agent") return node;
    const { agent: slug, ...rest } = node;
    const spec = agentFor(bundle, slug)?.agent.spec;
    const id = ids.get(slug) ?? newId();
    ids.set(slug, id);
    if (spec) {
      agents.set(catalogKey(id, "latest"), {
        status: "ok",
        entry: { name: slug, ...spec, published: true },
      });
    }
    return { ...rest, agentId: id, version: "latest" as const };
  });
  const doc = workflowDocumentSchema.parse({ ...bundle.workflow.document, nodes });
  return { doc, catalog: { agents, workflows: new Map() } };
}

describe("workflow templates", () => {
  it.each(workflowTemplates.map((t) => [t.workflow.slug, t] as const))(
    "%s validates against the agents it uses",
    (_slug, bundle) => {
      const { doc, catalog } = installed(bundle);
      expect(new Set(doc.nodes.map((n) => n.id)).size).toBe(doc.nodes.length);
      const errors = validateWorkflow(doc, catalog).filter((i) => i.severity === "error");
      expect(errors).toEqual([]);
    },
  );

  it.each(workflowTemplates.map((t) => [t.workflow.slug, t] as const))(
    "%s has every skill and MCP server its agents name",
    (_slug, bundle) => {
      const skills = new Set([...bundle.skills, ...builtinSkills].map((s) => s.slug));
      const servers = new Set(bundle.mcpServers.map((s) => s.name));
      for (const node of bundle.workflow.document.nodes) {
        if (node.kind !== "agent") continue;
        const capabilities = agentFor(bundle, node.agent)?.agent.spec.capabilities;
        expect(capabilities, `agent ${node.agent}`).toBeDefined();
        for (const slug of capabilities?.skills ?? []) expect(skills).toContain(slug);
        for (const name of capabilities?.mcpServers ?? []) expect(servers).toContain(name);
      }
    },
  );
});

describe("built-in agents", () => {
  it("name only built-in skills, and slugs are unique", () => {
    const skills = new Set(builtinSkills.map((s) => s.slug));
    expect(skills.size).toBe(builtinSkills.length);
    const slugs = builtinAgents.map((a) => a.agent.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const { agent } of builtinAgents) {
      for (const slug of agent.spec.capabilities.skills) expect(skills).toContain(slug);
    }
  });
});
