import { jsonSchemaSchema, type ModelEntry, type ModelRef } from "@agentic/contracts";
import { Button, JsonView, Label, ModelPicker, Switch, Textarea, UsageSummary } from "@agentic/ui";
import { type FormEvent, useId, useState } from "react";
import { useLlmStream } from "./use-llm-stream";

const SAMPLE_SCHEMA = `{
  "type": "object",
  "properties": { "answer": { "type": "string" } },
  "required": ["answer"]
}`;

/** "Test": one prompt to one model, streamed, with optional structured output. */
export function TestPrompt({
  models,
  providerNames,
}: {
  models: ModelEntry[];
  providerNames: Record<string, string>;
}) {
  const [target, setTarget] = useState<ModelRef>();
  const [prompt, setPrompt] = useState("Say hello in one short sentence.");
  const [structured, setStructured] = useState(false);
  const [schemaText, setSchemaText] = useState(SAMPLE_SCHEMA);
  const [formError, setFormError] = useState<string>();
  const { state, start, cancel } = useLlmStream();
  const id = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target) return setFormError("Choose a model.");
    let outputSchema: Record<string, unknown> | undefined;
    if (structured) {
      const parsed = jsonSchemaSchema.safeParse(safeJson(schemaText));
      if (!parsed.success) return setFormError("The schema must be a JSON object.");
      outputSchema = parsed.data;
    }
    setFormError(undefined);
    void start({ ...target, prompt, outputSchema });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-model`}>Model</Label>
        <ModelPicker
          id={`${id}-model`}
          models={models}
          value={target}
          onChange={setTarget}
          providerNames={providerNames}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-prompt`}>Prompt</Label>
        <Textarea
          id={`${id}-prompt`}
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id={`${id}-structured`} checked={structured} onCheckedChange={setStructured} />
        <Label htmlFor={`${id}-structured`}>Structured output (JSON Schema)</Label>
      </div>
      {structured && (
        <Textarea
          aria-label="Output JSON Schema"
          rows={5}
          className="font-mono text-code"
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          spellCheck={false}
        />
      )}
      {formError && <p className="text-sm text-danger-ink">{formError}</p>}
      <div className="flex justify-end gap-2">
        {state.running && (
          <Button type="button" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={state.running || !prompt.trim()}>
          {state.running ? "Running…" : "Run test"}
        </Button>
      </div>
      <StreamOutput state={state} />
    </form>
  );
}

function StreamOutput({ state }: { state: ReturnType<typeof useLlmStream>["state"] }) {
  if (!state.running && !state.text && !state.result && !state.error) return null;
  return (
    <div aria-live="polite" className="grid gap-2 border-t border-border pt-3">
      {state.thinking && (
        <details className="text-sm text-fg-muted">
          <summary>Thinking</summary>
          <p className="whitespace-pre-wrap">{state.thinking}</p>
        </details>
      )}
      <p data-selectable className="min-h-6 whitespace-pre-wrap">
        {state.text || (state.running ? "…" : "")}
      </p>
      {state.result?.structured !== undefined && <JsonView value={state.result.structured} />}
      {state.error && (
        <p role="alert" className="rounded-control bg-danger-tint p-2 text-sm text-danger-ink">
          {state.error}
        </p>
      )}
      {state.result && (
        <UsageSummary
          usage={state.result.usage}
          costUsd={state.result.costUsd}
          durationMs={state.result.durationMs}
        />
      )}
    </div>
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
