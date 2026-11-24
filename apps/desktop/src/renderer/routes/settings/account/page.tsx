import { Button, Label, Switch, toast } from "@agentic/ui";
import { useId, useState } from "react";
import { useAuthGate } from "../../../lib/core";
import { showError } from "../../../lib/show-error";
import { CredentialsForm } from "../../auth/credentials-form";
import { MembersList } from "./members-list";
import { useSetAuthSettings } from "./queries";

/** Settings → Account: who you are, sign-out, auto sign-in (local DB), and the workspace's members. */
export function AccountPage() {
  const id = useId();
  const gate = useAuthGate();
  const saveSettings = useSetAuthSettings();
  const [creating, setCreating] = useState(false);
  const user = gate?.status.user;
  if (!gate || !user) return null;
  const { status, client, setSession } = gate;
  const isOwner = status.role === "owner";
  const localAccount = user.kind === "local";

  const signOut = async () => {
    try {
      await client.auth.signOut();
    } catch (err) {
      showError(err);
    }
    await setSession(null);
  };

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">Account</h2>
        <p className="text-fg-muted">
          {status.workspace?.name ?? "Workspace"} on the{" "}
          {status.dbMode === "remote" ? "team database" : "local database"}.
        </p>
      </header>
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
        <div className="grid flex-1 gap-0.5">
          <p className="font-medium">{user.displayName}</p>
          <p className="text-sm text-fg-muted" data-selectable>
            {!user.email
              ? "No account yet: the app signs you in automatically"
              : status.signedIn
                ? user.email
                : `${user.email} · signed in automatically`}
          </p>
        </div>
        {status.signedIn && <Button onClick={signOut}>Sign out</Button>}
        {localAccount && !creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Create account
          </Button>
        )}
      </div>
      {localAccount && creating && (
        <div className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
          <p className="text-fg-muted">
            Your agents, workflows, and chats stay yours. You'll need this account to sign in on a
            team database or with <code>agentic login</code>.
          </p>
          <CredentialsForm
            client={client}
            mode="sign-up"
            onSession={(session) => {
              toast.success("Account created");
              void setSession(session.token);
            }}
          />
        </div>
      )}
      {status.autoSignInAvailable && isOwner && (
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
          <div className="grid flex-1 gap-0.5">
            <Label htmlFor={`${id}-auto`}>Sign in automatically</Label>
            <p className="text-sm text-fg-muted">
              On this Mac's local database, open straight into your workspace. Turn it off to ask
              for a password every time.
            </p>
          </div>
          <Switch
            id={`${id}-auto`}
            checked={status.autoSignIn}
            disabled={saveSettings.isPending}
            onCheckedChange={(autoSignIn) =>
              saveSettings.mutate({ autoSignIn }, { onError: (err) => showError(err) })
            }
          />
        </div>
      )}
      <div className="grid gap-2">
        <h3 className="font-medium">Members</h3>
        <MembersList meId={user.id} isOwner={isOwner} />
      </div>
    </section>
  );
}
