import { type JsonLogicRule, jsonLogicRuleSchema } from "@agentic/contracts";
import { useState } from "react";
import { Textarea } from "../../../primitives/input";

type Props = { value: JsonLogicRule; onChange: (value: JsonLogicRule) => void };

/** The advanced path: a JSON-logic rule over `input` and `nodes.<id>.output`. */
export function ExpressionInput({ value, onChange }: Props) {
  const [text, setText] = useState(() => JSON.stringify(value));
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="grid gap-1">
      <Textarea
        aria-label="JSON-logic expression"
        aria-invalid={invalid}
        spellCheck={false}
        className="min-h-14 font-mono text-code"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parse(event.target.value);
          setInvalid(!parsed);
          if (parsed) onChange(parsed);
        }}
      />
      <p className="text-xs text-fg-subtle">
        e.g. {'{"cat": [{"var": "input.task"}, " — ", {"var": "nodes.plan.output.summary"}]}'}
      </p>
    </div>
  );
}

function parse(text: string): JsonLogicRule | undefined {
  try {
    return jsonLogicRuleSchema.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
}
