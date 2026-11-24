import { type ToolGuardrails, toolGuardrailsSchema } from "@agentic/contracts";
import { Button, Input, Label, TagListInput, toast } from "@agentic/ui";
import { FolderPlus } from "lucide-react";
import { useId, useState } from "react";
import { invoke } from "../../../lib/bridge";
import { showError } from "../../../lib/show-error";
import { useSetGuardrails } from "./queries";

/** Allowed folders, the per-call timeout, and the output limit for every tool call. */
export function GuardrailsForm({ initial }: { initial: ToolGuardrails }) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const save = useSetGuardrails();
  const addFolder = async () => {
    try {
      const { path } = await invoke("dialog.openDirectory", {});
      if (path && !value.allowedDirs.includes(path)) {
        setValue({ ...value, allowedDirs: [...value.allowedDirs, path] });
      }
    } catch (err) {
      showError(err);
    }
  };
  const submit = () => {
    const parsed = toolGuardrailsSchema.safeParse(value);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid settings");
    save.mutate(parsed.data, {
      onSuccess: () => toast.success("Saved tool guardrails"),
      onError: (err) => showError(err),
    });
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-dirs`}>Allowed folders</Label>
        <div className="flex gap-2">
          <TagListInput
            id={`${id}-dirs`}
            className="flex-1 font-mono text-code"
            placeholder="/Users/me/code"
            value={value.allowedDirs}
            onChange={(allowedDirs) => setValue({ ...value, allowedDirs })}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Add a folder"
            onClick={addFolder}
          >
            <FolderPlus aria-hidden />
          </Button>
        </div>
        <p className="text-sm text-fg-muted">
          Tools run only in the private scratch folder and inside these folders (and their
          subfolders). A chat or agent working dir elsewhere is refused.
        </p>
      </div>
      <div className="flex gap-4">
        <NumberField
          id={`${id}-timeout`}
          label="Timeout (s)"
          value={value.timeoutMs / 1000}
          onChange={(s) => setValue({ ...value, timeoutMs: Math.round(s * 1000) })}
        />
        <NumberField
          id={`${id}-output`}
          label="Output limit (KB)"
          value={value.maxOutputBytes / 1000}
          onChange={(kb) => setValue({ ...value, maxOutputBytes: Math.round(kb * 1000) })}
        />
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="number"
        className="w-32"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </div>
  );
}
