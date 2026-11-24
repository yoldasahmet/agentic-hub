import { Button } from "@agentic/ui";
import { useState } from "react";
import type { AuthGate } from "../../lib/core";
import { CredentialsForm, type CredentialsMode } from "./credentials-form";

/**
 * Shown instead of the app while nobody is signed in: always on a team DB,
 * and on the local DB once auto sign-in is off. Opens on sign-up when the
 * database has no accounts yet.
 */
export function SignInScreen({ gate }: { gate: AuthGate }) {
  const { status } = gate;
  const [mode, setMode] = useState<CredentialsMode>(status.hasAccounts ? "sign-in" : "sign-up");
  const signUp = mode === "sign-up";
  const where = status.dbMode === "remote" ? "this team database" : "this Mac";

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <section className="grid w-full max-w-sm gap-5 rounded-card border border-border bg-surface p-6 shadow-1">
        <header className="grid gap-1">
          <h1 className="font-serif text-xl">{signUp ? "Create your account" : "Sign in"}</h1>
          <p className="text-fg-muted">
            {signUp
              ? status.hasAccounts
                ? `You'll join the shared workspace on ${where}.`
                : `The first account owns the workspace on ${where}.`
              : `Use your account on ${where}.`}
          </p>
        </header>
        <CredentialsForm
          key={mode}
          client={gate.client}
          mode={mode}
          onSession={(session) => void gate.setSession(session.token)}
        />
        <Button variant="link" size="sm" onClick={() => setMode(signUp ? "sign-in" : "sign-up")}>
          {signUp ? "Have an account? Sign in" : "New here? Create an account"}
        </Button>
      </section>
    </div>
  );
}
