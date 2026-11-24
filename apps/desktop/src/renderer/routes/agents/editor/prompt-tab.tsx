import { type AgentPrompt, fieldsToSchema, type IoField, templateFields } from "@agentic/contracts";
import {
  type FormValue,
  Label,
  SchemaForm,
  TemplateInput,
  TemplatePreview,
  Textarea,
} from "@agentic/ui";
import { useState } from "react";

type Props = {
  prompt: AgentPrompt;
  inputs: IoField[];
  onChange: (prompt: AgentPrompt) => void;
  /** For `human` agents the template is the question the gate asks. */
  human: boolean;
};

/** System prompt and template with `{{input.x}}` completion, and a live preview on sample inputs. */
export function PromptTab({ prompt, inputs, onChange, human }: Props) {
  const [sample, setSample] = useState<FormValue>({});
  const names = inputs.map((f) => f.name);
  const unknown = templateFields(prompt.template).filter((f) => !names.includes(f));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="grid content-start gap-4">
        {!human && (
          <div className="grid gap-1.5">
            <Label htmlFor="system-prompt">System prompt</Label>
            <Textarea
              id="system-prompt"
              className="min-h-32"
              placeholder="Who the agent is and how it works"
              value={prompt.system}
              onChange={(event) => onChange({ ...prompt, system: event.target.value })}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="template">{human ? "Question" : "Message template"}</Label>
          <p className="-mt-1 text-sm text-fg-muted">
            Type <code className="font-mono">{"{{"}</code> to insert an input.
          </p>
          <TemplateInput
            id="template"
            fields={names}
            value={prompt.template}
            placeholder={human ? "Approve {{input.plan}}?" : "{{input.task}}"}
            onChange={(template) => onChange({ ...prompt, template })}
          />
          {unknown.length > 0 && (
            <p className="text-sm text-warning-ink">Not an input: {unknown.join(", ")}</p>
          )}
        </div>
      </section>
      <section className="grid content-start gap-4">
        <div className="grid gap-1.5">
          <h2 className="font-serif text-lg">Preview</h2>
          <TemplatePreview template={prompt.template} input={sample} />
        </div>
        <details className="rounded-card border border-border bg-surface p-3">
          <summary className="cursor-pointer text-fg-muted">Sample inputs</summary>
          <div className="mt-3">
            <SchemaForm schema={fieldsToSchema(inputs)} value={sample} onChange={setSample} />
          </div>
        </details>
      </section>
    </div>
  );
}
