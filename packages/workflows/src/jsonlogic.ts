import type { JsonLogicRule } from "@agentic/contracts";

type Operator = (args: unknown[]) => unknown;

/**
 * A small JSON-logic evaluator (ported from the reference) with the
 * operators the condition builder offers. Comparisons are strict except
 * for numbers, so `"3" > 2` still works for values parsed from text.
 */
const operators: Record<string, Operator> = {
  "==": ([a, b]) => a === b || (isNumeric(a) && isNumeric(b) && Number(a) === Number(b)),
  "!=": ([a, b]) => !operators["=="]?.([a, b]),
  "!": ([a]) => !truthy(a),
  "!!": ([a]) => truthy(a),
  and: (args) => args.every(truthy),
  or: (args) => args.some(truthy),
  ">": ([a, b]) => Number(a) > Number(b),
  "<": ([a, b]) => Number(a) < Number(b),
  ">=": ([a, b]) => Number(a) >= Number(b),
  "<=": ([a, b]) => Number(a) <= Number(b),
  "+": (args) => args.reduce<number>((sum, n) => sum + Number(n), 0),
  "-": ([a, b]) => Number(a) - Number(b),
  in: ([needle, haystack]) => {
    if (Array.isArray(haystack)) return haystack.includes(needle);
    return typeof haystack === "string" && typeof needle === "string" && haystack.includes(needle);
  },
  cat: (args) => args.map((a) => (a == null ? "" : String(a))).join(""),
  if: ([cond, then, otherwise]) => (truthy(cond) ? then : otherwise),
};

/** Reads `a.b.c` from `data`. Unknown paths are `null`, as in json-logic-js. */
export function readPath(data: unknown, path: string): unknown {
  if (path === "") return data;
  let current: unknown = data;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return null;
    current = Reflect.get(current, key) ?? null;
  }
  return current;
}

export function applyJsonLogic(rule: unknown, data: unknown): unknown {
  if (Array.isArray(rule)) return rule.map((r) => applyJsonLogic(r, data));
  if (rule === null || typeof rule !== "object") return rule;
  const entries = Object.entries(rule);
  const [entry] = entries;
  if (!entry || entries.length !== 1) return rule;
  const [op, raw] = entry;
  const args = Array.isArray(raw) ? raw : [raw];
  if (op === "var") {
    const path = applyJsonLogic(args[0], data);
    const value = readPath(data, typeof path === "string" ? path : String(path ?? ""));
    return value === null && args.length > 1 ? applyJsonLogic(args[1], data) : value;
  }
  const operator = operators[op];
  if (!operator) throw new Error(`Unknown JSON-logic operator "${op}"`);
  return operator(args.map((arg) => applyJsonLogic(arg, data)));
}

/** A missing condition always passes. */
export function evaluateCondition(rule: JsonLogicRule | null, data: unknown): boolean {
  return rule === null || truthy(applyJsonLogic(rule, data));
}

/** JSON-logic truthiness: empty arrays are false. */
function truthy(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function isNumeric(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)))
  );
}
