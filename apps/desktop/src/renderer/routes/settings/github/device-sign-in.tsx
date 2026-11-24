import { Button, Input, Label, toast } from "@agentic/ui";
import { useEffect, useId, useState } from "react";
import { showError } from "../../../lib/show-error";
import {
  useDeviceFlowState,
  useGithubSettings,
  useSaveGithubSettings,
  useStartDeviceFlow,
} from "../../github/queries";

/**
 * GitHub's device sign-in for an OAuth app: Core polls GitHub and hands the
 * token to main for the Keychain. Needs the OAuth app's (public) client id.
 */
export function DeviceSignIn() {
  const id = useId();
  const settings = useGithubSettings();
  const save = useSaveGithubSettings();
  const start = useStartDeviceFlow();
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState<string>();
  const state = useDeviceFlowState(flowId);
  const status = state.data?.status;

  useEffect(() => setClientId(settings.data?.oauthClientId ?? ""), [settings.data]);
  useEffect(() => {
    if (status !== "pending" || !flowId) return;
    const timer = setInterval(() => void state.refetch(), 3000);
    return () => clearInterval(timer);
  }, [status, flowId, state]);
  useEffect(() => {
    if (status === "done") toast.success("Signed in to GitHub");
    else if (status && status !== "pending") toast.error(state.data?.error ?? "Sign-in failed");
  }, [status, state.data?.error]);

  const begin = () =>
    start.mutate(undefined, {
      onSuccess: (flow) => {
        setFlowId(flow.flowId);
        window.open(flow.verificationUri, "_blank", "noopener");
      },
      onError: (err) => showError(err),
    });

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Sign in with GitHub (device code)</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          className="flex-1 font-mono text-code"
          placeholder="OAuth app client id (Iv1… or Ov23…)"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          onBlur={() =>
            clientId !== (settings.data?.oauthClientId ?? "") &&
            save.mutate({ oauthClientId: clientId.trim() })
          }
        />
        <Button disabled={!settings.data?.oauthClientId || start.isPending} onClick={begin}>
          Sign in
        </Button>
      </div>
      {start.data && status === "pending" && (
        <p className="rounded-control bg-info-tint px-3 py-2 text-info-ink">
          Enter <strong className="font-mono">{start.data.userCode}</strong> at{" "}
          {start.data.verificationUri}. Waiting for GitHub…
        </p>
      )}
      <p className="text-sm text-fg-muted">
        Register an OAuth app with device flow enabled and paste its client id. The token is kept in
        the Keychain like a personal access token.
      </p>
    </div>
  );
}
