import { useState } from "react";
import { Button } from "../../primitives/button";
import { Input, Textarea } from "../../primitives/input";
import { Label } from "../../primitives/label";

export type JsonEditorProps = {
  initial: Record<string, unknown>;
  /** Nodes the edit may be written as; empty means "as the last node". */
  nodes: string[];
  busy?: boolean;
  onSave: (values: Record<string, unknown>, asNode: string | undefined) => void;
};

/**
 * Edits state values as JSON (the "Advanced" path; SchemaForm arrives in
 * P6.2). Invalid JSON is reported inline and never sent.
 */
export function JsonEditor({ initial, nodes, busy, onSave }: JsonEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [asNode, setAsNode] = useState("");
  const parsed = parseObject(text);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.ok) onSave(parsed.value, asNode.trim() || undefined);
      }}
    >
      <Textarea
        aria-label="State values (JSON)"
        aria-invalid={!parsed.ok}
        spellCheck={false}
        className="min-h-60 font-mono text-code"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {!parsed.ok && <p className="text-sm text-danger-ink">{parsed.error}</p>}
      <div className="grid gap-1">
        <Label htmlFor="as-node">Write as node (optional)</Label>
        <Input
          id="as-node"
          list="as-node-options"
          placeholder="Last node that ran"
          value={asNode}
          onChange={(event) => setAsNode(event.target.value)}
        />
        <datalist id="as-node-options">
          {nodes.map((node) => (
            <option key={node} value={node} />
          ))}
        </datalist>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!parsed.ok || busy}>
          Save as new checkpoint
        </Button>
      </div>
    </form>
  );
}

type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function parseObject(text: string): Parsed {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "State values must be a JSON object." };
    }
    return { ok: true, value: Object.fromEntries(Object.entries(value)) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}
