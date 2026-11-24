import { Button, Input } from "@agentic/ui";
import { FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "../../../lib/bridge";
import { showError } from "../../../lib/show-error";

type Props = { value: string | null; onChange: (path: string | null) => void };

/** Where CLI agents and terminal mode run for this chat. Saved on Enter, blur, or Browse. */
export function WorkingDirInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => {
    const next = draft.trim() || null;
    if (next !== value) onChange(next);
  };
  return (
    <div className="flex gap-1">
      <Input
        id="chat-workdir"
        className="flex-1 font-mono text-code"
        placeholder="Each agent's own policy"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        aria-label="Choose a folder"
        onClick={async () => {
          try {
            const { path } = await invoke("dialog.openDirectory", {
              defaultPath: value ?? undefined,
            });
            if (path) onChange(path);
          } catch (err) {
            showError(err);
          }
        }}
      >
        <FolderOpen aria-hidden />
      </Button>
      {value && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Clear the working dir"
          onClick={() => onChange(null)}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
