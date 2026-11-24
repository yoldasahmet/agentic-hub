import { Button, EntityAvatar, toast } from "@agentic/ui";
import { showError } from "../../lib/show-error";
import { useInstallTemplate, useWorkflowTemplates } from "../workflows/queries";
import { SetupStep, type StepState } from "./setup-step";

/** Starter workflows (data in packages/workflows/templates), each with the agents it uses. */
export function TemplatesStep() {
  const templates = useWorkflowTemplates();
  const install = useInstallTemplate();
  const anyInstalled = templates.data?.some((t) => t.installed) ?? false;
  const state: StepState = anyInstalled ? "done" : templates.isPending ? "checking" : "todo";
  return (
    <SetupStep
      number={4}
      title="Starter workflows"
      optional
      state={state}
      description="Add ready-made workflows to try or copy. Each one also adds the library agents it uses."
    >
      <ul className="grid gap-2">
        {templates.data?.map((t) => (
          <li
            key={t.slug}
            className="flex items-center gap-3 rounded-card border border-border p-3"
          >
            <EntityAvatar color={t.color} icon={t.icon} />
            <div className="grid min-w-0 flex-1">
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-fg-muted">{t.description}</span>
            </div>
            <Button
              size="sm"
              variant={t.installed ? "secondary" : "primary"}
              disabled={t.installed || install.isPending}
              onClick={() =>
                install.mutate(t.slug, {
                  onSuccess: () => {
                    toast.success(`Added ${t.name} to Workflows`);
                    void templates.refetch();
                  },
                  onError: (err) => showError(err),
                })
              }
            >
              {t.installed ? "Added" : "Add"}
            </Button>
          </li>
        ))}
      </ul>
    </SetupStep>
  );
}
