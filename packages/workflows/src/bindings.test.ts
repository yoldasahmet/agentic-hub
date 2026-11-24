import { describe, expect, it } from "vitest";
import { type BindingScope, projectInput, resolveBinding } from "./bindings";

const scope: BindingScope = {
  input: { task: "Ship it", count: 2 },
  nodes: {
    plan: { output: { steps: ["a"], title: "Plan" }, status: "succeeded", runs: 1 },
  },
};

describe("bindings", () => {
  it("resolves inputs, node fields, whole outputs, literals, and expressions", () => {
    expect(resolveBinding({ kind: "input", field: "task" }, scope)).toBe("Ship it");
    expect(resolveBinding({ kind: "node", node: "plan", field: "title" }, scope)).toBe("Plan");
    expect(resolveBinding({ kind: "node", node: "plan", field: null }, scope)).toEqual({
      steps: ["a"],
      title: "Plan",
    });
    expect(resolveBinding({ kind: "literal", value: [1] }, scope)).toEqual([1]);
    const logic = { cat: [{ var: "input.task" }, "!"] };
    expect(resolveBinding({ kind: "expression", logic }, scope)).toBe("Ship it!");
  });

  it("treats unrun nodes and null expressions as missing", () => {
    expect(resolveBinding({ kind: "node", node: "review", field: "x" }, scope)).toBeUndefined();
    const logic = { var: "input.nope" };
    expect(resolveBinding({ kind: "expression", logic }, scope)).toBeUndefined();
  });

  it("projects bound fields, using fallbacks and skipping missing ones", () => {
    const input = projectInput(
      {
        task: { kind: "input", field: "task" },
        review: {
          kind: "node",
          node: "review",
          field: "text",
          fallback: { kind: "literal", value: "no review" },
        },
        gone: { kind: "input", field: "missing" },
        zero: { kind: "literal", value: 0 },
      },
      scope,
    );
    expect(input).toEqual({ task: "Ship it", review: "no review", zero: 0 });
  });
});
