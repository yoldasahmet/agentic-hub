import type { IoField, JsonValue } from "@agentic/contracts";
import { Input, Textarea } from "../../primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { Switch } from "../../primitives/switch";
import { TagListInput } from "../tag-list-input";
import { JsonTextInput } from "./json-text-input";

type Props = {
  field: IoField;
  id: string;
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
  invalid: boolean;
  disabled?: boolean;
};

/** The widget for one field type. Empty values become `undefined`, so optional fields stay unset. */
export function FieldInput({ field, id, value, onChange, invalid, disabled }: Props) {
  const common = { id, disabled, "aria-invalid": invalid || undefined };
  switch (field.type) {
    case "long":
      return (
        <Textarea
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    case "number":
    case "integer":
      return (
        <Input
          {...common}
          type="number"
          step={field.type === "integer" ? 1 : "any"}
          min={field.min}
          max={field.max}
          className="w-40"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            onChange(Number.isFinite(next) ? next : undefined);
          }}
        />
      );
    case "bool":
      return (
        <Switch {...common} checked={value === true} onCheckedChange={(next) => onChange(next)} />
      );
    case "select":
      return (
        <Select
          disabled={disabled}
          value={typeof value === "string" ? value : undefined}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger id={id} aria-invalid={invalid || undefined}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi":
      return (
        <TagListInput
          id={id}
          placeholder={field.options?.length ? field.options.join(", ") : "Type and press Enter"}
          value={Array.isArray(value) ? value.filter((v) => typeof v === "string") : []}
          onChange={(next) => onChange(next.length ? next : undefined)}
        />
      );
    case "json":
      return <JsonTextInput id={id} disabled={disabled} value={value} onChange={onChange} />;
    default:
      return (
        <Input
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
  }
}
