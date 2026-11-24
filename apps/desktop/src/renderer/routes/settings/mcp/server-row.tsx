import type { McpServer, McpTestResult } from "@agentic/contracts";
import { Button, PermissionBadge, Switch } from "@agentic/ui";
import { Plug } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useDeleteMcpServer, useSaveMcpServer, useTestMcpServer } from "../tools/queries";

/** One server: enable switch, connection test with its tools, edit, delete. */
export function ServerRow({ server, onEdit }: { server: McpServer; onEdit: () => void }) {
  const [result, setResult] = useState<McpTestResult>();
  const save = useSaveMcpServer();
  const test = useTestMcpServer();
  const remove = useDeleteMcpServer();
  const where = server.config.transport === "stdio" ? server.config.command : server.config.url;
  const fail = (err: Error) => showError(err);
  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Plug aria-hidden className="size-4 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{server.name}</p>
          <p className="truncate font-mono text-xs text-fg-subtle" data-selectable>
            {server.config.transport} · {where}
          </p>
        </div>
        <Switch
          aria-label={`Enable ${server.name}`}
          checked={server.enabled}
          onCheckedChange={(enabled) =>
            save.mutate({ id: server.id, value: { ...server, enabled } }, { onError: fail })
          }
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={test.isPending}
          onClick={() => test.mutate(server.id, { onSuccess: setResult, onError: fail })}
        >
          {test.isPending ? "Testing…" : "Test"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => remove.mutate(server.id, { onError: fail })}
        >
          Delete
        </Button>
      </div>
      {result && !result.ok && (
        <p className="rounded-control bg-danger-tint p-2 text-sm text-danger-ink">
          {result.error?.message}
        </p>
      )}
      {result?.ok && (
        <ul className="grid gap-1 rounded-control bg-surface-sunken p-2 text-sm">
          {result.tools.length === 0 && <li className="text-fg-muted">Connected; no tools.</li>}
          {result.tools.map((tool) => (
            <li key={tool.name} className="flex items-center gap-2">
              <PermissionBadge permission={tool.permission} />
              <span className="font-mono text-code">{tool.name}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
