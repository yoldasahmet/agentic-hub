import type { BaseBinding, Binding, IoField, JsonLogicRule } from "@agentic/contracts";
import { CornerDownRight, X } from "lucide-react";
import { Button } from "../../../primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import { ExpressionInput } from "./expression-input";
import { LiteralInput } from "./literal-input";
import type { SourceGroup } from "./sources";

export type BindingPickerProps = {
  field: IoField;
  value: Binding | undefined;
  sources: SourceGroup[];
  onChange: (binding: Binding | undefined) => void;
};

/**
 * Where one field gets its value, picked from a list (workflow inputs,
 * upstream outputs), or a fixed value. JSON-logic expressions are the
 * advanced path. A fallback covers a skipped branch or a missing field.
 */
export function BindingPicker({ field, value, sources, onChange }: BindingPickerProps) {
  return (
    <div className="grid gap-1.5">
      <SourceSelect
        field={field}
        value={value}
        sources={sources}
        allowNone
        onChange={(base) => onChange(base && { ...base, fallback: value?.fallback })}
      />
      {value?.fallback ? (
        <div className="flex items-start gap-1">
          <CornerDownRight aria-hidden className="mt-2 size-3.5 shrink-0 text-fg-subtle" />
          <div className="min-w-0 flex-1">
            <SourceSelect
              field={field}
              value={value.fallback}
              sources={sources}
              onChange={(fallback) => onChange({ ...value, fallback })}
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove fallback"
            onClick={() => onChange({ ...value, fallback: undefined })}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        value && (
          <button
            type="button"
            className="justify-self-start text-xs text-fg-muted hover:text-fg"
            onClick={() => onChange({ ...value, fallback: { kind: "literal", value: null } })}
          >
            + Fallback when missing
          </button>
        )
      )}
    </div>
  );
}

type SourceSelectProps = {
  field: IoField;
  value: BaseBinding | undefined;
  sources: SourceGroup[];
  allowNone?: boolean;
  onChange: (binding: BaseBinding | undefined) => void;
};

function SourceSelect({ field, value, sources, allowNone, onChange }: SourceSelectProps) {
  const options = sources.flatMap((group) => [
    ...(group.node
      ? [{ key: `node:${group.node}:*`, label: `${group.label} › whole output` }]
      : []),
    ...group.fields.map((f) => ({
      key: group.node ? `node:${group.node}:${f.name}` : `input:${f.name}`,
      label: `${group.label} › ${f.name}`,
    })),
  ]);
  const choose = (key: string) => {
    if (key === "none") return onChange(undefined);
    if (key === "literal") return onChange({ kind: "literal", value: null });
    if (key === "expression") return onChange({ kind: "expression", logic: { var: "input" } });
    const [kind, a = "", b = ""] = key.split(":");
    if (kind === "input") return onChange({ kind: "input", field: a });
    onChange({ kind: "node", node: a, field: b === "*" ? null : b });
  };
  return (
    <div className="grid gap-1.5">
      <Select value={keyOf(value)} onValueChange={choose}>
        <SelectTrigger aria-label={`Source of ${field.name}`}>
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="none">Not set</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
          <SelectItem value="literal">Fixed value…</SelectItem>
          <SelectItem value="expression">Expression (advanced)…</SelectItem>
        </SelectContent>
      </Select>
      {value?.kind === "literal" && (
        <LiteralInput
          field={field}
          value={value.value}
          onChange={(v) => onChange({ kind: "literal", value: v })}
        />
      )}
      {value?.kind === "expression" && (
        <ExpressionInput
          value={value.logic}
          onChange={(logic: JsonLogicRule) => onChange({ kind: "expression", logic })}
        />
      )}
    </div>
  );
}

function keyOf(binding: BaseBinding | undefined): string {
  if (!binding) return "none";
  if (binding.kind === "input") return `input:${binding.field}`;
  if (binding.kind === "node") return `node:${binding.node}:${binding.field ?? "*"}`;
  return binding.kind;
}
