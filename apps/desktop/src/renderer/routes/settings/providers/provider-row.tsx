import type { ProviderStatus } from "@agentic/contracts";
import { Badge, type BadgeProps } from "@agentic/ui";
import { CircleCheck, CircleDashed, CircleHelp, CircleX, type LucideIcon } from "lucide-react";

type State = { label: string; icon: LucideIcon; tone: BadgeProps["tone"] };

function stateOf(p: ProviderStatus): State {
  if (!p.installed) return { label: "Not installed", icon: CircleDashed, tone: "neutral" };
  if (p.signedIn === true) return { label: "Ready", icon: CircleCheck, tone: "success" };
  if (p.signedIn === false) {
    const label = p.transport === "api" ? "No API key" : "Signed out";
    return { label, icon: CircleX, tone: "warning" };
  }
  return { label: "Unknown sign-in", icon: CircleHelp, tone: "info" };
}

/** One provider: state (icon + label), version, where it was found, and how to fix it. */
export function ProviderRow({ provider }: { provider: ProviderStatus }) {
  const { label, icon: Icon, tone } = stateOf(provider);
  const caps = provider.capabilities;
  return (
    <li className="grid gap-1 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{provider.name}</span>
        <Badge tone="neutral">{provider.transport === "cli" ? "CLI" : "API"}</Badge>
        {provider.version && (
          <span className="font-mono text-code text-fg-muted">v{provider.version}</span>
        )}
        <Badge tone={tone} className="ml-auto">
          <Icon aria-hidden />
          {label}
        </Badge>
      </div>
      <p className="text-sm text-fg-muted">
        {[
          provider.detail,
          caps.structuredOutput === "native" ? "native JSON schema" : "JSON by extraction",
          caps.tools && "function tools",
          caps.reasoning && "reasoning effort",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {provider.path && (
        <p data-selectable className="font-mono text-code text-fg-subtle">
          {provider.path}
        </p>
      )}
    </li>
  );
}
