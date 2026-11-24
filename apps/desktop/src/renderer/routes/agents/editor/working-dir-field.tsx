import type { IoField, WorkingDirPolicy } from "@agentic/contracts";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";

type Props = {
  policy: WorkingDirPolicy;
  inputs: IoField[];
  onChange: (policy: WorkingDirPolicy) => void;
};

/**
 * Where CLI providers and tools run: a private scratch dir, a fixed folder,
 * a path from an input, or a git worktree of the run made from a repo input.
 */
export function WorkingDirField({ policy, inputs, onChange }: Props) {
  const textInputs = inputs.filter((f) => f.type === "text");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="workdir-mode">Working directory</Label>
      <div className="flex gap-2">
        <Select
          value={policy.mode}
          onValueChange={(mode) => {
            if (mode === "scratch") onChange({ mode });
            if (mode === "fixed") onChange({ mode, path: "" });
            if (mode === "input" || mode === "worktree") {
              onChange({ mode, field: textInputs[0]?.name ?? "" });
            }
          }}
        >
          <SelectTrigger id="workdir-mode" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scratch">Private scratch</SelectItem>
            <SelectItem value="fixed">Fixed folder</SelectItem>
            <SelectItem value="input" disabled={textInputs.length === 0}>
              From an input
            </SelectItem>
            <SelectItem value="worktree" disabled={textInputs.length === 0}>
              Worktree per run
            </SelectItem>
          </SelectContent>
        </Select>
        {policy.mode === "fixed" && (
          <Input
            aria-label="Folder path"
            className="flex-1 font-mono text-code"
            placeholder="/Users/me/code/project"
            value={policy.path}
            onChange={(event) => onChange({ mode: "fixed", path: event.target.value })}
          />
        )}
        {(policy.mode === "input" || policy.mode === "worktree") && (
          <Select
            value={policy.field}
            onValueChange={(field) => onChange({ mode: policy.mode, field })}
          >
            <SelectTrigger
              aria-label={policy.mode === "input" ? "Input with the path" : "Input with the repo"}
              className="w-48"
            >
              <SelectValue placeholder="Choose an input" />
            </SelectTrigger>
            <SelectContent>
              {textInputs.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-sm text-fg-muted">
        {policy.mode === "worktree"
          ? "The input names owner/name (cloned from GitHub) or a local repo path. Each run gets its own branch agentic/<run>."
          : "Paths must be absolute. The folder is checked before a CLI starts."}
      </p>
    </div>
  );
}
