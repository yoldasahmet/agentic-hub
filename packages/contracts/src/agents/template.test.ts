import { describe, expect, it } from "vitest";
import { renderTemplate, templateFields, templateParts } from "./template";

describe("prompt templates", () => {
  const input = { task: "Fix it", plan: { steps: ["a", "b"] }, n: 3, empty: null };

  it("inserts strings as-is, other values as JSON, missing as nothing", () => {
    expect(renderTemplate("Do: {{input.task}} ({{ input.n }})", input)).toBe("Do: Fix it (3)");
    expect(renderTemplate("{{input.plan.steps}}", input)).toBe('[\n  "a",\n  "b"\n]');
    expect(renderTemplate("[{{input.nope}}][{{input.empty}}]", input)).toBe("[][]");
  });

  it("renders all inputs for {{input}}", () => {
    expect(JSON.parse(renderTemplate("{{input}}", { a: 1 }))).toEqual({ a: 1 });
  });

  it("marks missing values for the preview", () => {
    expect(templateParts("x {{input.task}} {{input.gone}}", input)).toEqual([
      { kind: "text", text: "x " },
      { kind: "value", path: "input.task", text: "Fix it", missing: false },
      { kind: "text", text: " " },
      { kind: "value", path: "input.gone", text: "", missing: true },
    ]);
  });

  it("lists distinct top-level fields and ignores other braces", () => {
    expect(templateFields("{{input.a.b}} {{input.a}} {{input.c}} {{other}} {{input}}")).toEqual([
      "a",
      "c",
    ]);
  });

  it("does not read inherited properties", () => {
    expect(renderTemplate("{{input.constructor}}", {})).toBe("");
  });
});
