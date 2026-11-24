import { cn } from "@agentic/ui";
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";

const sections = [
  { to: "/settings", label: "General" },
  { to: "/settings/account", label: "Account" },
  { to: "/settings/database", label: "Database" },
  { to: "/settings/providers", label: "Providers" },
  { to: "/settings/tools", label: "Tools" },
  { to: "/settings/mcp", label: "MCP servers" },
  { to: "/settings/skills", label: "Skills" },
  { to: "/settings/github", label: "GitHub" },
  { to: "/settings/jira", label: "Jira" },
  { to: "/settings/secrets", label: "Secrets" },
  { to: "/settings/logs", label: "Logs" },
] as const;

export function SettingsLayout() {
  // Log lines need the width; forms read better narrow.
  const wide = Boolean(useMatchRoute()({ to: "/settings/logs" }));
  return (
    <div className="flex h-full">
      <nav aria-label="Settings" className="w-48 shrink-0 space-y-0.5 border-r border-border p-3">
        <h1 className="px-2 pb-2 font-serif text-lg">Settings</h1>
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            activeOptions={{ exact: true }}
            className={cn(
              "block rounded-control px-2 py-1.5 text-fg-muted hover:bg-surface-sunken hover:text-fg",
              "data-[status=active]:bg-accent-tint data-[status=active]:text-accent-ink",
            )}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto px-8 py-8", wide ? "max-w-5xl" : "max-w-2xl")}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
