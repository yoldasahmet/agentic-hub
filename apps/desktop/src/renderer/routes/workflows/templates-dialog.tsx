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
import { LayoutTemplate } from "lucide-react";
import { showError } from "../../lib/show-error";
import { useInstallTemplate, useWorkflowTemplates } from "./queries";

/** Workflow templates (data, not code). Adding one also adds and publishes the agents it uses. */
export function TemplatesDialog() {
  const navigate = useNavigate();
  const templates = useWorkflowTemplates().data ?? [];
  const install = useInstallTemplate();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <LayoutTemplate aria-hidden /> Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflow templates</DialogTitle>
          <DialogDescription>
            Ready-made workflows built from the library agents. Adding one makes an editable copy.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {templates.map((t) => (
            <li
              key={t.slug}
              className="flex items-center gap-3 rounded-card border border-border p-3"
            >
              <EntityAvatar color={t.color} icon={t.icon} />
              <div className="grid min-w-0 flex-1">
                <span className="font-medium">{t.name}</span>
                <span className="text-sm text-fg-muted">{t.description}</span>
                <span className="text-xs text-fg-subtle">{t.nodes} nodes</span>
              </div>
              <Button
                size="sm"
                variant={t.installed ? "secondary" : "primary"}
                disabled={install.isPending}
                onClick={() =>
                  install.mutate(t.slug, {
                    onSuccess: (workflow) =>
                      void navigate({
                        to: "/workflows/$workflowId",
                        params: { workflowId: workflow.id },
                      }),
                    onError: (err) => showError(err),
                  })
                }
              >
                {t.installed ? "Add again" : "Add"}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
