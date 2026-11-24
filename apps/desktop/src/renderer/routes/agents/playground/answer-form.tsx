import { hasFields, type JsonValue } from "@agentic/contracts";
import { Button, type FormValue, SchemaForm, Textarea } from "@agentic/ui";
import { useState } from "react";
import { z } from "zod";

type Props = {
  /** The schema the answer must match; no fields means free text. */
  schema: Record<string, unknown>;
  initial?: Record<string, unknown>;
  submitLabel: string;
  busy?: boolean;
  issues?: string[];
  onSubmit: (value: JsonValue) => void;
  onCancel?: () => void;
};

/**
 * An answer shaped by an output schema: a gate's answer or an edited
 * output. Free-text agents get a textarea and answer `{ text }`.
 */
export function AnswerForm({
  schema,
  initial,
  submitLabel,
  busy,
  issues,
  onSubmit,
  onCancel,
}: Props) {
  const structured = hasFields(schema);
  const [value, setValue] = useState<FormValue>(() => toForm(initial));
  const text = typeof value.text === "string" ? value.text : "";
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(structured ? value : { text });
      }}
    >
      {structured ? (
        <SchemaForm schema={schema} value={value} onChange={setValue} issues={issues} />
      ) : (
        <Textarea
          aria-label="Answer"
          className="min-h-32"
          value={text}
          onChange={(event) => setValue({ text: event.target.value })}
        />
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const formValueSchema = z.record(z.string(), z.json()).catch({});

/** Output values back into form values; only JSON survives the trip. */
function toForm(initial: Record<string, unknown> | undefined): FormValue {
  return initial ? formValueSchema.parse(JSON.parse(JSON.stringify(initial))) : {};
}
