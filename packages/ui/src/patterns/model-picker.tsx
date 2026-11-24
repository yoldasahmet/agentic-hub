import type { ModelEntry, ModelRef } from "@agentic/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";

export type ModelPickerProps = {
  models: ModelEntry[];
  value: ModelRef | undefined;
  onChange: (ref: ModelRef) => void;
  /** Display names by provider id, e.g. { "claude-code": "Claude Code" }. */
  providerNames?: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

const SEP = "\u0000";
const toKey = (ref: ModelRef) => `${ref.providerId}${SEP}${ref.model}`;

/**
 * Picks one enabled model as "Provider · Model". The agent config and chat
 * extend it with reasoning and fallbacks (P6.4).
 */
export function ModelPicker({
  models,
  value,
  onChange,
  providerNames = {},
  placeholder = "Choose a model",
  disabled,
  id,
}: ModelPickerProps) {
  const enabled = models.filter((m) => m.enabled);
  const select = (key: string) => {
    const [providerId = "", model = ""] = key.split(SEP);
    onChange({ providerId, model });
  };
  return (
    <Select value={value ? toKey(value) : undefined} onValueChange={select} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {enabled.map((m) => (
          <SelectItem
            key={toKey({ providerId: m.providerId, model: m.modelId })}
            value={toKey({ providerId: m.providerId, model: m.modelId })}
          >
            <span className="text-fg-muted">{providerNames[m.providerId] ?? m.providerId} ·</span>{" "}
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
