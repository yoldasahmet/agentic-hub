import type { JsonLogicRule } from "@agentic/contracts";
import { Plus, X } from "lucide-react";
import { Button } from "../../../primitives/button";
import { Input } from "../../../primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import {
  type ConditionModel,
  type ConditionOp,
  type ConditionRow,
  conditionOps,
  fromRule,
  toRule,
  unaryOps,
} from "./condition-model";
import { ExpressionInput } from "./expression-input";

export type ConditionBuilderProps = {
  value: JsonLogicRule | null;
  /** `input.x`, `nodes.<id>.output.y`, … the paths a condition may test. */
  paths: Array<{ path: string; label: string }>;
  onChange: (value: JsonLogicRule | null) => void;
};

/** Conditions as rows (field, operator, value) joined by all/any. Other rules stay JSON. */
export function ConditionBuilder({ value, paths, onChange }: ConditionBuilderProps) {
  const model = fromRule(value);
  if (!model) {
    return (
      <div className="grid gap-1.5">
        <p className="text-sm text-fg-muted">This condition is too complex for the builder.</p>
        <ExpressionInput value={value ?? {}} onChange={onChange} />
        <Button
          size="sm"
          variant="ghost"
          className="justify-self-start"
          onClick={() => onChange(null)}
        >
          Clear
        </Button>
      </div>
    );
  }
  const set = (next: ConditionModel) => onChange(toRule(next));
  const setRow = (index: number, row: ConditionRow) =>
    set({ ...model, rows: model.rows.map((r, i) => (i === index ? row : r)) });
  return (
    <div className="grid gap-2">
      {model.rows.length === 0 && <p className="text-sm text-fg-muted">Always followed.</p>}
      {model.rows.length > 1 && (
        <Select
          value={model.join}
          onValueChange={(join) => set({ ...model, join: join === "or" ? "or" : "and" })}
        >
          <SelectTrigger aria-label="Match" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">All of these</SelectItem>
            <SelectItem value="or">Any of these</SelectItem>
          </SelectContent>
        </Select>
      )}
      {model.rows.map((row, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positions in the rule, rebuilt from it on each render
          key={index}
          className="grid gap-1 rounded-control border border-border p-2"
        >
          <div className="flex items-center gap-1">
            <Select
              value={row.path || undefined}
              onValueChange={(path) => setRow(index, { ...row, path })}
            >
              <SelectTrigger aria-label="Field">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {paths.map((p) => (
                  <SelectItem key={p.path} value={p.path}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remove condition"
              onClick={() => set({ ...model, rows: model.rows.filter((_, i) => i !== index) })}
            >
              <X aria-hidden />
            </Button>
          </div>
          <div className="flex gap-1">
            <Select value={row.op} onValueChange={(op) => setRow(index, { ...row, op: toOp(op) })}>
              <SelectTrigger aria-label="Operator" className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionOps).map(([op, label]) => (
                  <SelectItem key={op} value={op}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!unaryOps.has(row.op) && (
              <Input
                aria-label="Value"
                placeholder={row.op === "in" ? "a, b, c" : "value"}
                value={row.value}
                onChange={(event) => setRow(index, { ...row, value: event.target.value })}
              />
            )}
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="justify-self-start"
        onClick={() =>
          set({
            ...model,
            rows: [...model.rows, { path: paths[0]?.path ?? "", op: "==", value: "" }],
          })
        }
      >
        <Plus aria-hidden /> Add condition
      </Button>
    </div>
  );
}

function toOp(value: string): ConditionOp {
  return Object.keys(conditionOps).find((k): k is ConditionOp => k === value) ?? "==";
}
