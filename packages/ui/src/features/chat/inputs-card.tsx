import type { ChatInputsRequest, JsonValue } from "@agentic/contracts";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { EntityChip } from "../../patterns/entity-chip";
import { KeyHint } from "../../patterns/key-hint";
import { type FormValue, SchemaForm, schemaDefaults } from "../../patterns/schema-form/schema-form";
import { Button } from "../../primitives/button";
import { targetIdentity } from "./target-identity";

export type InputsCardProps = {
  request: ChatInputsRequest;
  busy?: boolean;
  onSubmit: (values: Record<string, JsonValue>) => void;
  onCancel: () => void;
};

/**
 * Chat intake: the target's input form, filled with what was read from the
 * conversation, asking for the rest. Writing a message instead also works.
 */
export function InputsCard({ request, busy, onSubmit, onCancel }: InputsCardProps) {
  const [value, setValue] = useState<FormValue>(() => ({
    ...schemaDefaults(request.schema),
    ...request.values,
  }));
  return (
    <form
      className="grid gap-3 rounded-card border border-warning bg-surface p-4 shadow-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmit(value);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList aria-hidden className="size-4 text-warning" />
        <h3 className="font-medium">A few more details for</h3>
        <EntityChip entity={targetIdentity(request.target)} />
      </div>
      <SchemaForm
        schema={request.schema}
        value={value}
        onChange={setValue}
        issues={request.issues}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-sm text-fg-muted">Or answer in a message below.</span>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <KeyHint keys={["⌘", "↵"]} />
        <Button type="submit" variant="primary" disabled={busy}>
          Run
        </Button>
      </div>
    </form>
  );
}
