import type { JsonValue, ToolApprovalAnswer, ToolApprovalRequest } from "@agentic/contracts";
import { useId, useState } from "react";
import { Button } from "../../primitives/button";
import { Textarea } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { PermissionBadge } from "../permission-badge";
import { JsonView } from "../state-inspector/json-view";

type Props = {
  request: ToolApprovalRequest;
  busy?: boolean;
  onAnswer: (answer: JsonValue) => void;
};

/**
 * Approve or reject tool use: one call with its input (`tool` agents), or
 * the tools an agent may use for this run. The working dir is shown
 * because it is where the tool acts.
 */
export function ToolApproval({ request, busy, onAnswer }: Props) {
  const id = useId();
  const [note, setNote] = useState("");
  const answer = (approved: boolean) => {
    const value: ToolApprovalAnswer = { approved, ...(note ? { note } : {}) };
    onAnswer(value);
  };
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1.5">
        {request.tools.map((tool) => (
          <li key={tool.name} className="flex items-start gap-2">
            <PermissionBadge permission={tool.permission} />
            <div className="min-w-0">
              <p className="font-mono text-code" data-selectable>
                {tool.name}
              </p>
              {tool.description && <p className="text-sm text-fg-muted">{tool.description}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-fg-muted">
        In{" "}
        <span className="font-mono text-code" data-selectable>
          {request.workingDir}
        </span>
      </p>
      {request.input && <JsonView value={request.input} />}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>Note</Label>
        <Textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => answer(false)}>
          Reject
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => answer(true)}>
          Approve
        </Button>
      </div>
    </div>
  );
}
