import type { LlmCallResult, ModelEntry } from "@agentic/contracts";
import { Badge, Button, cn, Label, Textarea, UsageSummary } from "@agentic/ui";
import { type FormEvent, useId, useState } from "react";
import { useCoreMutation } from "../../../lib/core-queries";
import { showError } from "../../../lib/show-error";

const MAX_TARGETS = 8;
const refKey = (m: { providerId: string; modelId: string }) => `${m.providerId}/${m.modelId}`;

/** Multi-model fan-out: one prompt to several models at once, answers side by side. */
export function CompareModels({
  models,
  providerNames,
}: {
  models: ModelEntry[];
  providerNames: Record<string, string>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("Explain recursion in one sentence.");
  const compare = useCoreMutation((client, input: Parameters<typeof client.llm.compare>[0]) =>
    client.llm.compare(input),
  );
  const id = useId();
  const enabled = models.filter((m) => m.enabled);

  const toggle = (key: string) =>
    setPicked((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : p.length < MAX_TARGETS ? [...p, key] : p,
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const targets = enabled
      .filter((m) => picked.includes(refKey(m)))
      .map((m) => ({ providerId: m.providerId, model: m.modelId }));
    compare.mutate({ prompt, targets }, { onError: (err) => showError(err) });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1"
    >
      <fieldset className="grid gap-1.5">
        <legend className="pb-1.5 font-medium">
          Models ({picked.length}/{MAX_TARGETS})
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {enabled.map((m) => {
            const key = refKey(m);
            const on = picked.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-sm",
                  on
                    ? "border-accent bg-accent-tint text-accent-ink"
                    : "border-border text-fg-muted hover:bg-surface-sunken",
                )}
              >
                {providerNames[m.providerId] ?? m.providerId} · {m.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-prompt`}>Prompt</Label>
        <Textarea
          id={`${id}-prompt`}
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={compare.isPending || picked.length === 0 || !prompt.trim()}
        >
          {compare.isPending ? "Comparing…" : "Compare"}
        </Button>
      </div>
      {compare.data && (
        <ul className="grid gap-2 md:grid-cols-2">
          {compare.data.results.map((r) => (
            <ResultCard
              key={`${r.providerId}/${r.model}`}
              result={r}
              name={providerNames[r.providerId]}
            />
          ))}
        </ul>
      )}
    </form>
  );
}

function ResultCard({ result, name }: { result: LlmCallResult; name?: string }) {
  return (
    <li className="grid content-start gap-2 rounded-control border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{name ?? result.providerId}</span>
        <span className="truncate font-mono text-code text-fg-muted">{result.model}</span>
        <Badge tone={result.ok ? "success" : "danger"} className="ml-auto">
          {result.ok ? "OK" : "Failed"}
        </Badge>
      </div>
      {result.text && (
        <p data-selectable className="whitespace-pre-wrap">
          {result.text}
        </p>
      )}
      {result.error && <p className="text-sm text-danger-ink">{result.error.message}</p>}
      <UsageSummary usage={result.usage} costUsd={result.costUsd} durationMs={result.durationMs} />
    </li>
  );
}
