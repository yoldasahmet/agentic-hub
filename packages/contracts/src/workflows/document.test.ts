import { describe, expect, it } from "vitest";
import { parseAgentAssistantId } from "../agents/runtime";
import { newId } from "../ids";
import { jiraKeysIn, jiraKeysInBranch } from "../jira/keys";
import {
  defaultWorkflowDocument,
  workflowDocumentSchema,
  workflowEdgeSchema,
  workflowNodeIdSchema,
  workflowNodeSchema,
} from "./document";
import {
  nodeOfStep,
  parseWorkflowAssistantId,
  reviewStepName,
  workflowAssistantId,
} from "./runtime";
import { hasBlockingIssues } from "./validation";

describe("workflow documents", () => {
  it("fills defaults for nodes and edges", () => {
    const node = workflowNodeSchema.parse({ kind: "gate", id: "approve" });
    expect(node).toMatchObject({
      enabled: true,
      bindings: {},
      join: "all",
      title: "Approve to continue",
      onReject: "stop",
    });
    const edge = workflowEdgeSchema.parse({ id: "e1", from: "a", to: "b" });
    expect(edge).toMatchObject({ condition: null, maxIterations: null, label: "" });
  });

  it("reserves `__` and keeps node ids path-safe", () => {
    expect(workflowNodeIdSchema.safeParse("plan_2").success).toBe(true);
    for (const bad of ["Plan", "2plan", "a-b", "a__b", ""]) {
      expect(workflowNodeIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects unknown node kinds and bad bindings", () => {
    expect(workflowNodeSchema.safeParse({ kind: "script", id: "a" }).success).toBe(false);
    const bad = { kind: "gate", id: "a", bindings: { x: { kind: "node", node: "b" } } };
    expect(workflowNodeSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts bindings with fallbacks", () => {
    const node = workflowNodeSchema.parse({
      kind: "agent",
      id: "a",
      agentId: newId(),
      bindings: {
        task: {
          kind: "node",
          node: "b",
          field: "text",
          fallback: { kind: "input", field: "task" },
        },
      },
    });
    expect(node.kind === "agent" && node.version).toBe("latest");
  });

  it("starts new workflows with one required task input", () => {
    const doc = defaultWorkflowDocument();
    expect(workflowDocumentSchema.parse(doc)).toEqual(doc);
    expect(doc.inputSchema).toMatchObject({ required: ["task"] });
    expect(doc.nodes).toEqual([]);
  });
});

describe("assistant ids and step names", () => {
  it("parses agent and workflow assistant ids", () => {
    const id = newId();
    expect(parseAgentAssistantId(`agent:${id}`)).toEqual({ agentId: id, draft: false });
    expect(parseAgentAssistantId(`agent-draft:${id}`)).toEqual({ agentId: id, draft: true });
    expect(parseAgentAssistantId("agent:not-a-uuid")).toBeUndefined();
    expect(parseWorkflowAssistantId(workflowAssistantId(id))).toMatchObject({ workflowId: id });
  });

  it("maps review steps back to their node", () => {
    expect(reviewStepName("plan", "input")).toBe("plan__input");
    expect(nodeOfStep("plan__output")).toBe("plan");
    expect(nodeOfStep("plan")).toBe("plan");
  });
});

describe("helpers", () => {
  it("finds Jira keys in text and branch names", () => {
    expect(jiraKeysIn("ABC-12 fixes utf-8 and ABC-12, see XY-3", null)).toEqual(["ABC-12", "XY-3"]);
    expect(jiraKeysInBranch("feature/abc-42-login")).toEqual(["ABC-42"]);
    expect(jiraKeysInBranch("main")).toEqual([]);
  });

  it("blocks only on errors", () => {
    const warning = { code: "orphaned_node" as const, severity: "warning" as const, message: "" };
    expect(hasBlockingIssues([warning])).toBe(false);
    expect(hasBlockingIssues([warning, { ...warning, severity: "error" }])).toBe(true);
  });
});
