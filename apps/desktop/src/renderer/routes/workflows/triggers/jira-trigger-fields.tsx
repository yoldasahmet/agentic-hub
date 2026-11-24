import { Label, Textarea } from "@agentic/ui";
import { useId } from "react";
import { FieldSelect, NONE } from "./github-trigger-fields";

export type JiraTriggerDraft = { jql: string; itemField: string; keyField: string };

/**
 * The JQL a Jira trigger watches and which workflow inputs receive the
 * issue (as a Markdown summary) and its key (e.g. to link the PR back).
 */
export function JiraTriggerFields({
  value,
  onChange,
  inputFields,
}: {
  value: JiraTriggerDraft;
  onChange: (next: JiraTriggerDraft) => void;
  inputFields: string[];
}) {
  const id = useId();
  const set = (patch: Partial<JiraTriggerDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor={`${id}-jql`}>Issues matching (JQL)</Label>
        <Textarea
          id={`${id}-jql`}
          rows={2}
          className="font-mono text-code"
          placeholder='project = ABC AND status = "Ready for dev" AND labels = agent'
          value={value.jql}
          onChange={(e) => set({ jql: e.target.value })}
        />
      </div>
      <FieldSelect
        label="Issue goes into"
        value={value.itemField}
        options={inputFields}
        onChange={(itemField) => set({ itemField })}
      />
      <FieldSelect
        label="Key goes into"
        value={value.keyField || NONE}
        options={inputFields}
        optional
        onChange={(v) => set({ keyField: v === NONE ? "" : v })}
      />
      <p className="col-span-2 text-sm text-fg-muted">
        Checked every two minutes. Each issue starts one run the first time it matches; issues that
        already match when the trigger is added don't.
      </p>
    </div>
  );
}
