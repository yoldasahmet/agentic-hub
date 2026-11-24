import { GITHUB_SECRETS } from "@agentic/contracts";
import { Button, Input, Label, toast } from "@agentic/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { showError } from "../../../lib/show-error";
import { useDeleteSecret, useSetSecret } from "../secrets/queries";

/** A personal access token goes straight to the vault (main); Core gets it from there. */
export function TokenForm({ hasToken }: { hasToken: boolean }) {
  const id = useId();
  const [value, setValue] = useState("");
  const set = useSetSecret();
  const remove = useDeleteSecret();
  const queries = useQueryClient();
  const refresh = () => queries.invalidateQueries({ queryKey: ["core"] });
  const save = () =>
    set.mutate(
      { name: GITHUB_SECRETS.token, value: value.trim() },
      {
        onSuccess: () => {
          setValue("");
          toast.success("Token saved to the Keychain");
          void refresh();
        },
        onError: (err) => showError(err),
      },
    );
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Personal access token</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          className="flex-1 font-mono text-code"
          placeholder={hasToken ? "•••••••• (saved)" : "github_pat_…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button disabled={!value.trim() || set.isPending} onClick={save}>
          Save
        </Button>
        {hasToken && (
          <Button
            variant="ghost"
            onClick={() => remove.mutate(GITHUB_SECRETS.token, { onSuccess: () => void refresh() })}
          >
            Remove
          </Button>
        )}
      </div>
      <p className="text-sm text-fg-muted">
        A fine-grained token needs Contents, Issues, and Pull requests (read and write) on the repos
        agents work in. Stored in the Keychain as <code>{GITHUB_SECRETS.token}</code>.
      </p>
    </div>
  );
}
