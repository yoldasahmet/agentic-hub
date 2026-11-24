import type { IoField } from "@agentic/contracts";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Switch } from "../../primitives/switch";
import { TagListInput } from "../tag-list-input";
import { FieldTypeSelect } from "./field-type-select";

type Props = {
  field: IoField;
  issue: string | undefined;
  first: boolean;
  last: boolean;
  onChange: (field: IoField) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
};

/** One field: name, type, required, description, and the type's own settings. */
export function FieldRow({ field, issue, first, last, onChange, onMove, onRemove }: Props) {
  const id = useId();
  const set = (patch: Partial<IoField>) => onChange({ ...field, ...patch });
  const choices = field.type === "select" || field.type === "multi";
  const numeric = field.type === "number" || field.type === "integer";
  return (
    <li className="grid min-w-0 gap-2 rounded-card border border-border bg-surface p-3">
      {/* Wraps in narrow panels (the workflow inspector): the name takes the first line. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Field name"
          aria-invalid={issue !== undefined}
          className="min-w-32 flex-1 basis-40 font-mono text-code"
          value={field.name}
          onChange={(event) => set({ name: event.target.value })}
        />
        <FieldTypeSelect value={field.type} onChange={(type) => set({ type })} />
        <div className="flex items-center gap-1.5">
          <Switch
            id={`${id}-req`}
            checked={field.required}
            onCheckedChange={(required) => set({ required })}
          />
          <Label htmlFor={`${id}-req`} className="text-sm">
            Required
          </Label>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={first}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={last}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${field.name}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {issue && <p className="text-sm text-danger-ink">{issue}</p>}
      <Input
        aria-label="Description"
        placeholder="What this field is for (the model sees it)"
        value={field.description}
        onChange={(event) => set({ description: event.target.value })}
      />
      {choices && (
        <TagListInput
          aria-label="Choices"
          placeholder={field.type === "multi" ? "Allowed values (optional)" : "Add a choice"}
          value={field.options ?? []}
          onChange={(options) => set({ options: options.length ? options : undefined })}
        />
      )}
      {numeric && (
        <div className="flex gap-2">
          <NumberBound label="Min" value={field.min} onChange={(min) => set({ min })} />
          <NumberBound label="Max" value={field.max} onChange={(max) => set({ max })} />
        </div>
      )}
    </li>
  );
}

function NumberBound(props: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Input
      type="number"
      aria-label={props.label}
      placeholder={props.label}
      className="w-28"
      value={props.value ?? ""}
      onChange={(event) => {
        const next = event.target.valueAsNumber;
        props.onChange(Number.isFinite(next) ? next : undefined);
      }}
    />
  );
}
