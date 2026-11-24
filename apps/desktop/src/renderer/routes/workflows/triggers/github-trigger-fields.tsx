import type { GithubTriggerEvent } from "@agentic/contracts";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";
import { useId } from "react";

export type GithubTriggerDraft = {
  repo: string;
  event: GithubTriggerEvent;
  label: string;
  itemField: string;
  repoField: string;
};

export const NONE = "__none";

/**
 * What a GitHub trigger watches and which workflow inputs receive the item
 * (as a Markdown summary) and the repo (`owner/name`, e.g. for a worktree).
 */
export function GithubTriggerFields({
  value,
  onChange,
  inputFields,
}: {
  value: GithubTriggerDraft;
  onChange: (next: GithubTriggerDraft) => void;
  inputFields: string[];
}) {
  const id = useId();
  const set = (patch: Partial<GithubTriggerDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-repo`}>Repository</Label>
        <Input
          id={`${id}-repo`}
          className="font-mono text-code"
          placeholder="owner/name"
          value={value.repo}
          onChange={(e) => set({ repo: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>When</Label>
        <Select value={value.event} onValueChange={(v: GithubTriggerEvent) => set({ event: v })}>
          <SelectTrigger aria-label="GitHub event">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="issue.opened">An issue is opened</SelectItem>
            <SelectItem value="issue.labeled">An issue gets a label</SelectItem>
            <SelectItem value="review.requested">My review is requested</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.event !== "review.requested" && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-label`}>
            Label{value.event === "issue.opened" ? " (optional)" : ""}
          </Label>
          <Input
            id={`${id}-label`}
            placeholder="e.g. agent"
            value={value.label}
            onChange={(e) => set({ label: e.target.value })}
          />
        </div>
      )}
      <FieldSelect
        label="Item goes into"
        value={value.itemField}
        options={inputFields}
        onChange={(itemField) => set({ itemField })}
      />
      <FieldSelect
        label="Repo goes into"
        value={value.repoField || NONE}
        options={inputFields}
        optional
        onChange={(v) => set({ repoField: v === NONE ? "" : v })}
      />
      <p className="col-span-2 text-sm text-fg-muted">
        Checked every two minutes. Items that already exist when the trigger is added don't start
        runs.
      </p>
    </div>
  );
}

export function FieldSelect(props: {
  label: string;
  value: string;
  options: string[];
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger aria-label={props.label}>
          <SelectValue placeholder="Choose an input" />
        </SelectTrigger>
        <SelectContent>
          {props.optional && <SelectItem value={NONE}>Nowhere</SelectItem>}
          {props.options.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
