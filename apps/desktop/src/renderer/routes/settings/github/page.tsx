import { Separator } from "@agentic/ui";
import { CircleCheck, CircleSlash } from "lucide-react";
import { useGithubStatus } from "../../github/queries";
import { DeviceSignIn } from "./device-sign-in";
import { TokenForm } from "./token-form";

const sourceLabel = {
  vault: "token in the Keychain",
  gh: "the GitHub CLI (gh auth)",
  none: "nothing yet",
} as const;

/** Settings → GitHub: who the app acts as, and the ways to connect. */
export function GithubSettingsPage() {
  const status = useGithubStatus().data;
  const connected = status?.login != null;
  const Icon = connected ? CircleCheck : CircleSlash;
  return (
    <section className="grid max-w-2xl gap-6">
      <header className="grid gap-1">
        <h2 className="font-serif text-xl">GitHub</h2>
        <p className="text-fg-muted">
          Browse repos, issues, and pull requests, give agents GitHub tools, and start workflows
          from GitHub activity. A saved token wins; otherwise an existing <code>gh auth login</code>{" "}
          is used.
        </p>
      </header>
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-1">
        <Icon
          className={connected ? "size-5 text-success-ink" : "size-5 text-fg-muted"}
          aria-hidden
        />
        <div className="grid flex-1 gap-0.5">
          <p className="font-medium">
            {connected ? `Signed in as ${status?.login}` : "Not connected"}
          </p>
          <p className="text-sm text-fg-muted">
            Using {sourceLabel[status?.source ?? "none"]}
            {status?.scopes.length ? ` · scopes: ${status.scopes.join(", ")}` : ""}
            {status?.ghAvailable && status.source !== "gh" ? " · gh is signed in too" : ""}
          </p>
          {status?.error && <p className="text-sm text-danger-ink">{status.error}</p>}
        </div>
      </div>
      <TokenForm hasToken={status?.source === "vault"} />
      <Separator />
      <DeviceSignIn />
    </section>
  );
}
