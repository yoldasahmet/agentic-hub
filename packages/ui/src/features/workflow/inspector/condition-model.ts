import type { JsonLogicRule } from "@agentic/contracts";

export const conditionOps = {
  "==": "equals",
  "!=": "does not equal",
  ">": "is greater than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most",
  in: "is one of",
  "!!": "is set",
  "!": "is empty",
} as const;
export type ConditionOp = keyof typeof conditionOps;
export const unaryOps = new Set<ConditionOp>(["!!", "!"]);

export type ConditionRow = { path: string; op: ConditionOp; value: string };
export type ConditionModel = { join: "and" | "or"; rows: ConditionRow[] };

/** The builder's rows as a JSON-logic rule; no rows means "always". */
export function toRule({ join, rows }: ConditionModel): JsonLogicRule | null {
  const rules = rows.filter((r) => r.path).map(rowRule);
  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0] ?? null;
  return { [join]: rules };
}

function rowRule({ path, op, value }: ConditionRow): JsonLogicRule {
  const v = { var: path };
  if (unaryOps.has(op)) return { [op]: [v] };
  if (op === "in") return { in: [v, value.split(",").map((s) => scalar(s.trim()))] };
  return { [op]: [v, scalar(value)] };
}

/**
 * Reads a rule back into rows. Rules the builder can't show (nested
 * groups, other operators) return undefined and stay as JSON.
 */
export function fromRule(rule: JsonLogicRule | null): ConditionModel | undefined {
  if (rule === null) return { join: "and", rows: [] };
  const [entry] = Object.entries(rule);
  if (!entry || Object.keys(rule).length !== 1) return undefined;
  const [op, args] = entry;
  if ((op === "and" || op === "or") && Array.isArray(args)) {
    const rows = args.map((a) => (isRule(a) ? readRow(a) : undefined));
    if (rows.some((r) => r === undefined)) return undefined;
    return { join: op, rows: rows.filter((r): r is ConditionRow => r !== undefined) };
  }
  const row = readRow(rule);
  return row ? { join: "and", rows: [row] } : undefined;
}

function readRow(rule: JsonLogicRule): ConditionRow | undefined {
  const [entry] = Object.entries(rule);
  if (!entry || !(entry[0] in conditionOps) || !Array.isArray(entry[1])) return undefined;
  const op = Object.keys(conditionOps).find((k): k is ConditionOp => k === entry[0]);
  const [first, second] = entry[1];
  const path = isRule(first) && typeof first.var === "string" ? first.var : undefined;
  if (!op || path === undefined) return undefined;
  if (unaryOps.has(op)) return { path, op, value: "" };
  if (op === "in") {
    return Array.isArray(second) ? { path, op, value: second.map(String).join(", ") } : undefined;
  }
  return second !== null && typeof second === "object"
    ? undefined
    : { path, op, value: String(second) };
}

function scalar(text: string): string | number | boolean | null {
  if (text === "true" || text === "false") return text === "true";
  if (text === "null") return null;
  if (text.trim() !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

function isRule(value: unknown): value is JsonLogicRule {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
