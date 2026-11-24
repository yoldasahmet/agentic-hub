import {
  type ModelEntry,
  type ModelRef,
  type ReasoningEffort,
  reasoningEffortSchema,
} from "@agentic/contracts";
import { Plus, X } from "lucide-react";
import { Button } from "../primitives/button";
import { Label } from "../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";
import { ModelPicker } from "./model-picker";

export type ModelChain = {
  model: ModelRef | undefined;
  reasoning: ReasoningEffort | undefined;
  fallbacks: ModelRef[];
};

export type ModelChainPickerProps = ModelChain & {
  models: ModelEntry[];
  providerNames?: Record<string, string>;
  onChange: (chain: ModelChain) => void;
  maxFallbacks?: number;
};

const DEFAULT_REASONING = "default";

/**
 * The model an agent calls, its reasoning effort (when the model has
 * one), and fallbacks tried in order when a call fails.
 */
export function ModelChainPicker({
  model,
  reasoning,
  fallbacks,
  models,
  providerNames,
  onChange,
  maxFallbacks = 4,
}: ModelChainPickerProps) {
  const chain = { model, reasoning, fallbacks };
  const entry = models.find(
    (m) => m.providerId === model?.providerId && m.modelId === model?.model,
  );
  const setFallback = (index: number, ref: ModelRef) =>
    onChange({ ...chain, fallbacks: fallbacks.map((f, i) => (i === index ? ref : f)) });
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="agent-model">Model</Label>
        <ModelPicker
          id="agent-model"
          models={models}
          value={model}
          providerNames={providerNames}
          onChange={(next) => onChange({ ...chain, model: next })}
        />
      </div>
      {entry?.supportsReasoning && (
        <div className="grid gap-1.5">
          <Label htmlFor="agent-reasoning">Reasoning effort</Label>
          <Select
            value={reasoning ?? DEFAULT_REASONING}
            onValueChange={(next) => {
              const parsed = reasoningEffortSchema.safeParse(next);
              onChange({ ...chain, reasoning: parsed.success ? parsed.data : undefined });
            }}
          >
            <SelectTrigger id="agent-reasoning" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_REASONING}>Model default</SelectItem>
              {reasoningEffortSchema.options.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {effort[0]?.toUpperCase()}
                  {effort.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label>Fallbacks</Label>
        <p className="-mt-1 text-sm text-fg-muted">
          Tried in order when the model fails to answer.
        </p>
        {fallbacks.map((ref, index) => (
          // Fallbacks may repeat a model while being edited; position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <div key={index} className="flex items-center gap-2">
            <ModelPicker
              models={models}
              value={ref}
              providerNames={providerNames}
              onChange={(next) => setFallback(index, next)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove fallback"
              onClick={() =>
                onChange({ ...chain, fallbacks: fallbacks.filter((_, i) => i !== index) })
              }
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        {fallbacks.length < maxFallbacks && (
          <div>
            <Button
              size="sm"
              disabled={!models.some((m) => m.enabled)}
              onClick={() => {
                const first = models.find((m) => m.enabled);
                if (first) {
                  const ref = { providerId: first.providerId, model: first.modelId };
                  onChange({ ...chain, fallbacks: [...fallbacks, ref] });
                }
              }}
            >
              <Plus aria-hidden /> Add fallback
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
