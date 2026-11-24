import type { JsonValue } from "@agentic/contracts";
import { jsonValueSchema } from "@agentic/contracts";
import { Button, Label, Textarea } from "@agentic/ui";
import { useId, useState } from "react";

type Props = { busy?: boolean; onResume: (answer: JsonValue) => void };

/**
 * Answers a human gate with a JSON value: what `interrupt()` returns in
 * the graph. Gates get schema forms in P7.8; this is the generic fallback.
 */
export function GateAnswerForm({ busy, onResume }: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const parsed = parse(text);

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.ok) onResume(parsed.value);
      }}
    >
      <Label htmlFor={id}>Answer (JSON)</Label>
      <Textarea
        id={id}
        spellCheck={false}
        aria-invalid={text !== "" && !parsed.ok}
        className="min-h-16 font-mono text-code"
        placeholder='{ "approved": true }'
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={!parsed.ok || busy}>
          Resume
        </Button>
      </div>
    </form>
  );
}

function parse(text: string): { ok: true; value: JsonValue } | { ok: false } {
  try {
    const value = jsonValueSchema.safeParse(JSON.parse(text));
    return value.success ? { ok: true, value: value.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
