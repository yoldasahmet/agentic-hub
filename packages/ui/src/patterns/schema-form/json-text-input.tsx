import type { JsonValue } from "@agentic/contracts";
import { useState } from "react";
import { Textarea } from "../../primitives/input";

type Props = {
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
  id?: string;
  disabled?: boolean;
  /** Require an object (the "Edit as JSON" view of a whole form). */
  object?: boolean;
  "aria-label"?: string;
};

/** JSON in a textarea. Only valid JSON reaches `onChange`; errors show inline. */
export function JsonTextInput({ value, onChange, object, ...rest }: Props) {
  const [text, setText] = useState(() =>
    value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState<string>();
  return (
    <div className="grid gap-1">
      <Textarea
        {...rest}
        spellCheck={false}
        aria-invalid={error !== undefined}
        className="min-h-24 font-mono text-code"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseJson(event.target.value, object);
          setError(parsed.error);
          if (!parsed.error) onChange(parsed.value);
        }}
      />
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </div>
  );
}

function parseJson(text: string, object?: boolean): { value?: JsonValue; error?: string } {
  if (!text.trim()) return object ? { value: {} } : { value: undefined };
  try {
    const value: JsonValue = JSON.parse(text);
    if (object && (typeof value !== "object" || value === null || Array.isArray(value))) {
      return { error: "Enter a JSON object" };
    }
    return { value };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}
