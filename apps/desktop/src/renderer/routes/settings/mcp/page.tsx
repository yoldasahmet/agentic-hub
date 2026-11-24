import type { McpServer } from "@agentic/contracts";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, EmptyState } from "@agentic/ui";
import { Plug } from "lucide-react";
import { useState } from "react";
import { useMcpServers } from "../tools/queries";
import { ServerForm } from "./server-form";
import { ServerRow } from "./server-row";

type Editing = { server?: McpServer } | undefined;

export function McpPage() {
  const servers = useMcpServers();
  const [editing, setEditing] = useState<Editing>();
  return (
    <section className="grid gap-6">
      <header className="flex items-end gap-4">
        <div className="grid flex-1 gap-1">
          <h2 className="font-serif text-xl">MCP servers</h2>
          <p className="text-fg-muted">
            Model Context Protocol servers add tools. Attach a server to an agent or a terminal
            session; Claude Code and Codex run it themselves, other models call it through the app.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({})}>
          Add server
        </Button>
      </header>
      <div className="rounded-card border border-border bg-surface shadow-1">
        {servers.data && servers.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {servers.data.map((server) => (
              <ServerRow key={server.id} server={server} onEdit={() => setEditing({ server })} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Plug}
            title="No MCP servers yet"
            description="Add a local command (stdio) or a remote URL (streamable HTTP)."
            className="py-10"
          />
        )}
      </div>
      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.server ? `Edit ${editing.server.name}` : "Add an MCP server"}
            </DialogTitle>
          </DialogHeader>
          {editing && <ServerForm server={editing.server} onDone={() => setEditing(undefined)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
