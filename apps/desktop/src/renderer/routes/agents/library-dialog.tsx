import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EntityAvatar,
} from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Library } from "lucide-react";
import { showError } from "../../lib/show-error";
import { useBuiltinAgents, useInstallBuiltin } from "./queries";

/** The built-in agents (data, not code): add one to the workspace as an editable copy. */
export function LibraryDialog() {
  const navigate = useNavigate();
  const builtins = useBuiltinAgents().data ?? [];
  const install = useInstallBuiltin();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Library aria-hidden /> Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>Agent library</DialogTitle>
          <DialogDescription>
            Add a ready-made agent or open the one already in your workspace.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid min-h-0 gap-2 overflow-y-auto pr-2">
          {builtins.map((b) => (
            <li
              key={b.slug}
              className="flex items-center gap-3 rounded-card border border-border p-3"
            >
              <EntityAvatar color={b.color} icon={b.icon} />
              <div className="grid min-w-0 flex-1">
                <span className="font-medium">{b.name}</span>
                <span className="text-sm text-fg-muted">{b.description}</span>
              </div>
              <Button
                size="sm"
                variant={b.installed ? "secondary" : "primary"}
                disabled={install.isPending}
                onClick={() =>
                  install.mutate(b.slug, {
                    onSuccess: (agent) =>
                      void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } }),
                    onError: (err) => showError(err),
                  })
                }
              >
                {b.installed ? "Open" : "Add"}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
