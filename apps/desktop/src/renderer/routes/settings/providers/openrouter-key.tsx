import { PROVIDER_SECRETS } from "@agentic/contracts";
import { Button, toast } from "@agentic/ui";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useDeleteSecret } from "../secrets/queries";
import { SecretForm } from "../secrets/secret-form";
import { useHasOpenRouterKey, useRefreshProviders } from "./queries";

/** The OpenRouter key lives in the vault; main hands it to Core in memory. */
export function OpenRouterKey() {
  const hasKey = useHasOpenRouterKey();
  const [editing, setEditing] = useState(false);
  const remove = useDeleteSecret();
  const refresh = useRefreshProviders();

  const done = () => {
    setEditing(false);
    refresh.mutate(undefined);
  };
  const removeKey = () =>
    remove.mutate(PROVIDER_SECRETS.openrouterApiKey, {
      onSuccess: () => {
        toast.success("Removed the OpenRouter key");
        refresh.mutate(undefined);
      },
      onError: (err) => showError(err),
    });

  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
      <div className="flex items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="font-medium">OpenRouter API key</h3>
          <p className="text-sm text-fg-muted">
            {hasKey
              ? "Saved in the Keychain. It is never shown again."
              : "Create a key at openrouter.ai/keys to use OpenRouter models."}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {hasKey && (
              <Button size="sm" variant="ghost" onClick={removeKey} disabled={remove.isPending}>
                Remove
              </Button>
            )}
            <Button size="sm" onClick={() => setEditing(true)}>
              {hasKey ? "Replace" : "Add key"}
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <>
          <SecretForm name={PROVIDER_SECRETS.openrouterApiKey} onDone={done} />
          <Button
            size="sm"
            variant="ghost"
            className="justify-self-start"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
