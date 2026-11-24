import { builtinAgents } from "@agentic/agents";
import { type AgentSpec, type LlmRequest, newId, workflowDocumentSchema } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { workflowTemplates } from "./templates";
import { compileWorkflow, testDeps } from "./test/runtime";

const sdlc = workflowTemplates.find((t) => t.workflow.slug === "sdlc-pipeline");

/** The template's agents on the fake provider, without tools or worktrees. */
function fakeAgents(): { ids: Map<string, string>; specs: Record<string, AgentSpec> } {
  const ids = new Map<string, string>();
  const specs: Record<string, AgentSpec> = {};
  for (const node of sdlc?.workflow.document.nodes ?? []) {
    if (node.kind !== "agent") continue;
    const bundle = [...(sdlc?.agents ?? []), ...builtinAgents].find(
      (a) => a.agent.slug === node.agent,
    );
    if (!bundle) throw new Error(`no agent ${node.agent}`);
    const { spec } = bundle.agent;
    ids.set(node.agent, newId());
    specs[ids.get(node.agent) ?? ""] = {
      ...spec,
      runtime: {
        ...spec.runtime,
        model: { providerId: "fake", model: "x" },
        workingDir: { mode: "scratch" },
      },
      capabilities: { ...spec.capabilities, tools: [], skills: [], mcpServers: [] },
    };
  }
  return { ids, specs };
}

/** Review blocks once, tests fail once, then everything passes. */
function script() {
  const calls = new Map<string, number>();
  const reply = (req: LlmRequest) => {
    const role = /You are the (\w+)/.exec(req.system ?? "")?.[1] ?? "";
    const n = (calls.get(role) ?? 0) + 1;
    calls.set(role, n);
    const answers: Record<string, unknown> = {
      Planner: { spec: { goal: "g" }, tasks: [{ title: "t", successCriteria: "c" }] },
      Designer: { design: { summary: "d" } },
      Coder: { prLink: "https://github.com/o/r/pull/7", summary: `pass ${n}` },
      Reviewer: { blocking: n === 1, summary: n === 1 ? "null check missing" : "ok" },
      Tester: { passed: n > 1, summary: n > 1 ? "all green" : "login spec fails" },
      Deployer: { version: "abc123", url: "https://app.example" },
    };
    return JSON.stringify(answers[role] ?? {});
  };
  return { reply, calls };
}

describe("SDLC pipeline template", () => {
  it("loops to the coder on blockers and failing tests, then deploys", async () => {
    if (!sdlc) throw new Error("sdlc-pipeline template missing");
    const { ids, specs } = fakeAgents();
    const { reply, calls } = script();
    const { deps, provider } = testDeps([reply]);
    const nodes = sdlc.workflow.document.nodes.map((node) => {
      if (node.kind !== "agent") return node;
      const { agent, ...rest } = node;
      return { ...rest, agentId: ids.get(agent) };
    });
    const doc = workflowDocumentSchema.parse({ ...sdlc.workflow.document, nodes });
    const state = await compileWorkflow(doc, specs, deps).start({ task: "Add login", repo: "o/r" });

    expect(Object.fromEntries(calls)).toEqual({
      Planner: 1,
      Designer: 1,
      Coder: 3,
      Reviewer: 3,
      Tester: 2,
      Deployer: 1,
    });
    const coderPrompts = provider.requests
      .filter((r) => r.system?.includes("You are the Coder"))
      .map((r) => String(r.messages.at(-1)?.content));
    expect(coderPrompts[0]).not.toContain("pull/7");
    expect(coderPrompts[1]).toContain("Review blockers:\nnull check missing");
    expect(coderPrompts[2]).toContain("Failing tests:\nlogin spec fails");
    expect(coderPrompts[2]).toContain("Existing pull request: https://github.com/o/r/pull/7");
    expect(state.output).toEqual({
      prUrl: "https://github.com/o/r/pull/7",
      deployedUrl: "https://app.example",
    });
  });
});
