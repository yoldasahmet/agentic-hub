import type { JsonSchema, JsonValue } from "@agentic/contracts";
import { useId, useState } from "react";
import { z } from "zod";
import { Button } from "../../primitives/button";
import { Textarea } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { type FormValue, SchemaForm, schemaDefaults } from "../schema-form/schema-form";

type Props = {
  schema: JsonSchema;
  data: Record<string, JsonValue>;
  issues: string[];
  busy?: boolean;
  /** Approve/reject with an optional comment (workflow gates); else a plain answer. */
  decide?: boolean;
  freeText?: boolean;
  onAnswer: (answer: JsonValue) => void;
};

const formSchema = z.record(z.string(), z.json()).catch({});

/** The editable data (SchemaForm), an optional comment, and the decision. */
export function GateForm({ schema, data, issues, busy, decide, freeText, onAnswer }: Props) {
  const id = useId();
  const [value, setValue] = useState<FormValue>(() => ({
    ...schemaDefaults(schema),
    ...formSchema.parse(data),
  }));
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const answer = (action: "approve" | "reject") =>
    onAnswer({ action, data: value, ...(comment ? { comment } : {}) });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (decide) answer("approve");
        else onAnswer(freeText ? { text } : value);
      }}
    >
      {freeText ? (
        <Textarea
          aria-label="Answer"
          className="min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <SchemaForm
          schema={schema}
          value={value}
          onChange={setValue}
          issues={issues}
          emptyHint={decide ? "Nothing to edit: approve or reject." : undefined}
        />
      )}
      {decide && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-comment`}>Comment</Label>
          <Textarea
            id={`${id}-comment`}
            className="min-h-12"
            placeholder="Optional"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>
      )}
      {freeText && issues.length > 0 && (
        <p className="text-sm text-danger-ink">{issues.join(" ")}</p>
      )}
      <div className="flex justify-end gap-2">
        {decide && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => answer("reject")}>
            Reject
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {decide ? "Approve" : "Answer"}
        </Button>
      </div>
    </form>
  );
}
