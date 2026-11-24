import { describe, expect, it } from "vitest";
import { applyJsonLogic, evaluateCondition, readPath } from "./jsonlogic";

const data = {
  input: { n: "3", list: ["a", "b"], name: "agentic" },
  nodes: { review: { output: { approved: true, score: 7 } } },
};

describe("JSON-logic", () => {
  it("reads paths, with defaults for missing ones", () => {
    expect(applyJsonLogic({ var: "nodes.review.output.score" }, data)).toBe(7);
    expect(applyJsonLogic({ var: ["nodes.gone.output", "fallback"] }, data)).toBe("fallback");
    expect(applyJsonLogic({ var: "input.list.1" }, data)).toBe("b");
    expect(readPath(data, "")).toBe(data);
    expect(readPath(data, "input.name.length.x")).toBeNull();
  });

  it("compares numbers parsed from text but nothing else loosely", () => {
    expect(applyJsonLogic({ "==": [{ var: "input.n" }, 3] }, data)).toBe(true);
    expect(applyJsonLogic({ ">": [{ var: "input.n" }, 2] }, data)).toBe(true);
    expect(applyJsonLogic({ "==": [0, false] }, data)).toBe(false);
    expect(applyJsonLogic({ "==": ["", 0] }, data)).toBe(false);
    expect(applyJsonLogic({ "!=": [1, "1"] }, data)).toBe(false);
  });

  it("supports the builder's operators", () => {
    expect(applyJsonLogic({ and: [true, { "!": false }, { "!!": [["x"]] }] }, data)).toBe(true);
    expect(applyJsonLogic({ or: [false, []] }, data)).toBe(false);
    expect(applyJsonLogic({ in: ["a", { var: "input.list" }] }, data)).toBe(true);
    expect(applyJsonLogic({ in: ["gent", { var: "input.name" }] }, data)).toBe(true);
    expect(applyJsonLogic({ cat: ["v", 1, null] }, data)).toBe("v1");
    expect(applyJsonLogic({ "+": [1, "2", 3] }, data)).toBe(6);
    expect(applyJsonLogic({ "-": [5, 2] }, data)).toBe(3);
    expect(applyJsonLogic({ if: [{ "<=": [1, 0] }, "yes", "no"] }, data)).toBe("no");
  });

  it("returns literals and arrays as-is", () => {
    expect(applyJsonLogic(5, data)).toBe(5);
    expect(applyJsonLogic([{ var: "input.n" }, 1], data)).toEqual(["3", 1]);
    expect(applyJsonLogic({ a: 1, b: 2 }, data)).toEqual({ a: 1, b: 2 });
  });

  it("refuses unknown operators", () => {
    expect(() => applyJsonLogic({ eval: ["1"] }, data)).toThrow(/Unknown JSON-logic operator/);
  });

  it("passes a missing condition and uses JSON-logic truthiness", () => {
    expect(evaluateCondition(null, data)).toBe(true);
    expect(evaluateCondition({ var: "nodes.review.output.approved" }, data)).toBe(true);
    expect(evaluateCondition({ var: "input.missing" }, data)).toBe(false);
  });
});
