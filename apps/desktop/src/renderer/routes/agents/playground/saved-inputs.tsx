import type { AgentTestInput } from "@agentic/contracts";
import {
  Button,
  type FormValue,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@agentic/ui";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useSetTestInputs, useTestInputs } from "../queries";

type Props = { agentId: string; value: FormValue; onLoad: (value: FormValue) => void };

/** Named test inputs: load one into the form, save the form under a name, or delete one. */
export function SavedInputs({ agentId, value, onLoad }: Props) {
  const saved = useTestInputs(agentId).data ?? [];
  const save = useSetTestInputs();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string>();
  const write = (inputs: AgentTestInput[], done: string) =>
    save.mutate(
      { id: agentId, inputs },
      { onSuccess: () => toast.success(done), onError: (err) => showError(err) },
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {saved.length > 0 && (
        <Select
          value={selected}
          onValueChange={(next) => {
            setSelected(next);
            const found = saved.find((s) => s.name === next);
            if (found) onLoad(found.input);
          }}
        >
          <SelectTrigger aria-label="Saved inputs" className="w-44">
            <SelectValue placeholder="Saved inputs" />
          </SelectTrigger>
          <SelectContent>
            {saved.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selected && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete ${selected}`}
          onClick={() => {
            write(
              saved.filter((s) => s.name !== selected),
              `Deleted ${selected}`,
            );
            setSelected(undefined);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
      <Input
        aria-label="Name for these inputs"
        placeholder="Name these inputs"
        className="w-44"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button
        size="sm"
        disabled={!name.trim() || save.isPending}
        onClick={() => {
          const entry = { name: name.trim(), input: value };
          write([...saved.filter((s) => s.name !== entry.name), entry], `Saved ${entry.name}`);
          setName("");
          setSelected(entry.name);
        }}
      >
        <Save aria-hidden /> Save
      </Button>
    </div>
  );
}
