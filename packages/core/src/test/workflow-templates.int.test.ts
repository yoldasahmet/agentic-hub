import {
  agentExportSchema,
  agentSchema,
  builtinAgentSchema,
  mcpServerSchema,
  skillSchema,
  validationIssueSchema,
  workflowBundleSchema,
  workflowSchema,
} from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db);
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
});

describe("workflow templates through Core", () => {
  it("lists the SDLC agents in the library, and adding one brings its skills", async () => {
    const library = await core.api(z.array(builtinAgentSchema), "GET", "/agents/builtins");
    expect(library.map((a) => a.slug)).toEqual(
      expect.arrayContaining(["sdlc-planner", "sdlc-coder", "sdlc-tester", "sdlc-deployer"]),
    );
    const tester = await core.api(agentSchema, "POST", "/agents/builtins/sdlc-tester/install");
    expect(tester.slug).toBe("sdlc-tester");
    const skills = await core.api(z.array(skillSchema), "GET", "/skills");
    expect(skills.map((s) => s.slug).sort()).toEqual(["e2e-testing", "test-runner"]);
  });

  it("installs the SDLC pipeline with its skills and a disabled Figma server", async () => {
    const mine = await core.api(skillSchema, "POST", "/skills", {
      source: "inline",
      name: "Our code style",
      slug: "code-style",
      content: "Tabs, always.",
    });

    const workflow = await core.api(
      workflowSchema,
      "POST",
      "/workflows/templates/sdlc-pipeline/install",
    );

    const skills = await core.api(z.array(skillSchema), "GET", "/skills");
    expect(skills.map((s) => s.slug).sort()).toEqual([
      "code-review",
      "code-style",
      "deploy-runbook",
      "design-system",
      "e2e-testing",
      "spec-writing",
      "test-runner",
    ]);
    expect(skills.find((s) => s.slug === "code-style")).toEqual(mine);

    const servers = await core.api(z.array(mcpServerSchema), "GET", "/mcp/servers");
    expect(servers).toEqual([
      expect.objectContaining({
        name: "figma",
        enabled: false,
        config: expect.objectContaining({ transport: "http" }),
      }),
    ]);

    const exported = await core.api(
      agentExportSchema,
      "GET",
      `/workflows/${workflow.id}/export?format=json`,
    );
    const bundle = workflowBundleSchema.parse(JSON.parse(exported.content));
    expect(bundle.agents.map((a) => a.agent.slug)).toContain("sdlc-coder");
    expect(bundle.skills.find((s) => s.slug === "code-style")?.content).toBe("Tabs, always.");
  });

  it("reuses what the workspace has when the template installs again", async () => {
    await core.api(workflowSchema, "POST", "/workflows/templates/sdlc-pipeline/install");
    expect(await core.api(z.array(skillSchema), "GET", "/skills")).toHaveLength(7);
    expect(await core.api(z.array(mcpServerSchema), "GET", "/mcp/servers")).toHaveLength(1);
  });

  it("keeps one built-in agent and restores its edits when added from the library", async () => {
    const path = "/agents/builtins/marketing-strategist/install";
    const [agent, repeated] = await Promise.all([
      core.api(agentSchema, "POST", path),
      core.api(agentSchema, "POST", path),
    ]);
    expect(repeated).toEqual(agent);
    const edited = await core.api(agentSchema, "PATCH", `/agents/${agent.id}`, {
      revision: agent.revision,
      description: "Our campaign planner",
    });
    await core.api(agentSchema, "POST", `/agents/${agent.id}/archive`, { archived: true });
    expect(await core.api(agentSchema, "POST", path)).toMatchObject({
      id: edited.id,
      description: edited.description,
      revision: edited.revision,
    });
    const copy = await core.api(agentSchema, "POST", `/agents/${agent.id}/duplicate`);
    expect(copy.id).not.toBe(agent.id);
    expect(copy.name).toBe("Marketing Strategist copy");
  });

  it("installs the marketing workflow with three published agents and no validation issues", async () => {
    const workflow = await core.api(
      workflowSchema,
      "POST",
      "/workflows/templates/marketing-campaign-draft/install",
    );
    const agents = await core.api(z.array(agentSchema), "GET", "/agents");
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    expect(
      workflow.draft.nodes.flatMap((node) => (node.kind === "agent" ? byId.get(node.agentId) : [])),
    ).toMatchObject([
      { slug: "marketing-strategist", latestVersion: 1 },
      { slug: "marketing-copywriter", latestVersion: 1 },
      { slug: "marketing-editor", latestVersion: 1 },
    ]);
    expect(
      await core.api(z.array(validationIssueSchema), "GET", `/workflows/${workflow.id}/validate`),
    ).toEqual([]);
  });
});
