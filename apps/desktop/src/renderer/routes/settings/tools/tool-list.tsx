import type { ToolDescriptor } from "@agentic/contracts";
import { PermissionBadge } from "@agentic/ui";

/** Tools grouped by their source: built-in groups (`fs`, `git`, …) and MCP servers. */
export function ToolList({ tools }: { tools: ToolDescriptor[] }) {
  const groups = new Map<string, ToolDescriptor[]>();
  for (const tool of tools) {
    const group = tool.source === "mcp" ? `MCP · ${tool.server}` : (tool.name.split(".")[0] ?? "");
    groups.set(group, [...(groups.get(group) ?? []), tool]);
  }
  return (
    <div className="grid gap-4">
      {[...groups].map(([group, items]) => (
        <section key={group} className="rounded-card border border-border bg-surface shadow-1">
          <h3 className="border-b border-border px-4 py-2 font-medium">{group}</h3>
          <ul className="divide-y divide-border">
            {items.map((tool) => (
              <li key={tool.name} className="flex items-start gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-code" data-selectable>
                    {tool.name}
                  </p>
                  <p className="text-sm text-fg-muted">{tool.description || tool.title}</p>
                </div>
                <PermissionBadge permission={tool.permission} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
