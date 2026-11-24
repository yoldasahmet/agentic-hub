import { JIRA_SECRETS } from "@agentic/contracts";
import { Button, Input, Label, toast } from "@agentic/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { showError } from "../../../lib/show-error";
import { useJiraSettings, useSaveJiraSettings, useTestJira } from "../../jira/queries";
import { useDeleteSecret, useSetSecret } from "../secrets/queries";

/**
 * Site and email are workspace settings in Core; the API token goes
 * straight to the vault (main). Test checks all three before saving.
 */
export function ConnectionForm({ hasToken }: { hasToken: boolean }) {
  const id = useId();
  const saved = useJiraSettings().data;
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  useEffect(() => {
    if (saved) {
      setSiteUrl(saved.siteUrl);
      setEmail(saved.email);
    }
  }, [saved]);
  const save = useSaveJiraSettings();
  const test = useTestJira();
  const setSecret = useSetSecret();
  const removeSecret = useDeleteSecret();
  const queries = useQueryClient();
  const onError = (err: Error) => showError(err);

  const runTest = () =>
    test.mutate(
      { siteUrl: siteUrl.trim(), email: email.trim(), token: token.trim() || undefined },
      {
        onSuccess: (r) =>
          r.ok ? toast.success(`Connected as ${r.user?.displayName}`) : toast.error(r.error),
        onError,
      },
    );
  const submit = async () => {
    try {
      if (token.trim())
        await setSecret.mutateAsync({ name: JIRA_SECRETS.token, value: token.trim() });
      await save.mutateAsync({ siteUrl: siteUrl.trim(), email: email.trim() });
      setToken("");
      toast.success("Jira settings saved");
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };
  const busy = save.isPending || setSecret.isPending;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-site`}>Site</Label>
        <Input
          id={`${id}-site`}
          placeholder="https://your-team.atlassian.net"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-email`}>Account email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-token`}>API token</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-token`}
            type="password"
            autoComplete="off"
            className="flex-1 font-mono text-code"
            placeholder={hasToken ? "•••••••• (saved)" : "From id.atlassian.com → API tokens"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {hasToken && (
            <Button
              variant="ghost"
              onClick={() =>
                removeSecret.mutate(JIRA_SECRETS.token, {
                  onSuccess: () => void queries.invalidateQueries({ queryKey: ["core"] }),
                })
              }
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-sm text-fg-muted">
          Stored in the Keychain as <code>{JIRA_SECRETS.token}</code>. Agents act with this
          account's permissions.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button disabled={!siteUrl.trim() || !email.trim() || test.isPending} onClick={runTest}>
          Test connection
        </Button>
        <Button
          variant="primary"
          disabled={!siteUrl.trim() || !email.trim() || busy}
          onClick={submit}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
