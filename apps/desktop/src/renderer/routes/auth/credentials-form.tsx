import type { CoreClient } from "@agentic/client";
import type { AuthSession } from "@agentic/contracts";
import { Button, Input, Label } from "@agentic/ui";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { showError } from "../../lib/show-error";

export type CredentialsMode = "sign-in" | "sign-up";

type Props = {
  client: CoreClient;
  mode: CredentialsMode;
  onSession(session: AuthSession): void;
};

/** Email + password (and a name for sign-up). Errors show as toasts; the password is never kept. */
export function CredentialsForm({ client, mode, onSession }: Props) {
  const id = useId();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      mode === "sign-up"
        ? client.auth.signUp({ email, password, displayName })
        : client.auth.signIn({ email, password }),
    onSuccess: (session) => {
      setPassword("");
      onSession(session);
    },
    onError: (err) => showError(err),
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate();
  };
  const signUp = mode === "sign-up";
  const ready =
    email.trim() && password && (!signUp || (displayName.trim() && password.length >= 8));

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      {signUp && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-password`}>Password</Label>
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {signUp && <p className="text-sm text-fg-muted">At least 8 characters.</p>}
      </div>
      <Button type="submit" variant="primary" disabled={!ready || submit.isPending}>
        {signUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
