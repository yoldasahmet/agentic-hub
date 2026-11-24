import { type AgentSpec, agentSpecSchema, type WorkflowDocument } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { refKey, resolveWorkflow, type WorkflowResolver } from "./resolve";
import { agentId, doc, llmSpec } from "./test/fixtures";

const agent = agentId();
const child = agentId();
const parent = agentId();

function resolver(docs: Record<string, WorkflowDocument>, specs: Record<string, AgentSpec>) {
  const r: WorkflowResolver = {
    agentSpec: async (id, version) => specs[refKey(id, version)],
    workflowDocument: async (id, version) => docs[refKey(id, version)],
  };
  return r;
}

describe("resolveWorkflow", () => {
  const childDoc = doc({ nodes: [{ kind: "agent", id: "a", agentId: agent, version: 1 }] });
  const specs = { [refKey(agent, 1)]: llmSpec() };

  it("loads pinned agents and subworkflows recursively", async () => {
    const top = doc({ nodes: [{ kind: "workflow", id: "sub", workflowId: child, version: 1 }] });
    const resolved = await resolveWorkflow(top, resolver({ [refKey(child, 1)]: childDoc }, specs), [
      parent,
    ]);
    const sub = resolved.workflows.get(refKey(child, 1));
    expect(sub?.agents.get(refKey(agent, 1))).toEqual(agentSpecSchema.parse(llmSpec()));
  });

  it("refuses unpinned nodes, missing versions, and cycles", async () => {
    const r = resolver({ [refKey(child, 1)]: childDoc }, specs);
    const latest = doc({ nodes: [{ kind: "agent", id: "a", agentId: agent }] });
    await expect(resolveWorkflow(latest, r, [])).rejects.toMatchObject({ code: "internal" });
    const missing = doc({ nodes: [{ kind: "agent", id: "a", agentId: agent, version: 2 }] });
    await expect(resolveWorkflow(missing, r, [])).rejects.toMatchObject({ code: "not_found" });
    const cyclic = doc({ nodes: [{ kind: "workflow", id: "s", workflowId: child, version: 1 }] });
    await expect(resolveWorkflow(cyclic, r, [child])).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("ignores disabled nodes and gates", async () => {
    const d = doc({
      nodes: [
        { kind: "agent", id: "a", agentId: agent, version: 9, enabled: false },
        { kind: "gate", id: "g" },
      ],
    });
    const resolved = await resolveWorkflow(d, resolver({}, {}), []);
    expect(resolved.agents.size).toBe(0);
  });
});
