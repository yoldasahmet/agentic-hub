import { secretNameSchema, secretValueSchema } from "@agentic/contracts";
import { Button, Input, Label, toast } from "@agentic/ui";
import { type FormEvent, useId, useState } from "react";
import { useSetSecret } from "./queries";

/** Adds a secret, or replaces one when `name` is fixed. The value is write-only. */
export function SecretForm({ name: fixedName, onDone }: { name?: string; onDone?: () => void }) {
  const [name, setName] = useState(fixedName ?? "");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const setSecret = useSetSecret();
  const id = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedName = secretNameSchema.safeParse(name.trim());
    if (!parsedName.success) return setError(parsedName.error.issues[0]?.message);
    const parsedValue = secretValueSchema.safeParse(value);
    if (!parsedValue.success) return setError("Enter a value.");
    setError(undefined);
    setSecret.mutate(
      { name: parsedName.data, value: parsedValue.data },
      {
        onSuccess: (meta) => {
          toast.success(`Saved ${meta.name}`);
          setValue("");
          if (!fixedName) setName("");
          onDone?.();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      {!fixedName && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="openrouter.api-key"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-value`}>Value</Label>
        <Input
          id={`${id}-value`}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoFocus={Boolean(fixedName)}
        />
      </div>
      {error && <p className="text-sm text-danger-ink">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={setSecret.isPending}>
          {fixedName ? "Replace value" : "Add secret"}
        </Button>
      </div>
    </form>
  );
}
