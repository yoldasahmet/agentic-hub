import type { Trigger, Workflow } from "@agentic/contracts";
import { Badge, Button, Switch, toast } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import {
  useCreateTrigger,
  useFireTrigger,
  useRemoveTrigger,
  useTriggers,
  useUpdateTrigger,
} from "../queries";
import { TriggerForm } from "./trigger-form";

const kindLabel = {
  manual: "Manual",
  schedule: "Schedule",
  github: "GitHub",
  jira: "Jira",
} as const;

/** Manual, scheduled, and GitHub triggers of this workflow; each fire is a normal run. */
export function TriggersTab({ workflow }: { workflow: Workflow }) {
  const triggers = useTriggers(workflow.id).data ?? [];
  const create = useCreateTrigger();
  // A new key empties the form after each trigger is added.
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="grid max-w-3xl gap-4 p-4">
      {!workflow.latestVersion && (
        <p className="text-warning-ink">
          Publish the workflow first: triggers run its latest published version.
        </p>
      )}
      <ul className="grid gap-2">
        {triggers.map((trigger) => (
          <TriggerRow key={trigger.id} workflowId={workflow.id} trigger={trigger} />
        ))}
      </ul>
      <TriggerForm
        key={formKey}
        workflow={workflow}
        busy={create.isPending}
        onSubmit={(input) =>
          create.mutate(
            { id: workflow.id, input },
            {
              onSuccess: () => {
                toast.success("Trigger added");
                setFormKey((k) => k + 1);
              },
              onError: (err) => showError(err),
            },
          )
        }
      />
    </div>
  );
}

function TriggerRow({ workflowId, trigger }: { workflowId: string; trigger: Trigger }) {
  const update = useUpdateTrigger();
  const fire = useFireTrigger();
  const remove = useRemoveTrigger();
  const onError = (err: Error) => showError(err);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
  return (
    <li className="grid gap-1 rounded-card border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{trigger.name}</span>
        <Badge>{kindLabel[trigger.kind]}</Badge>
        <Switch
          aria-label="Enabled"
          checked={trigger.enabled}
          onCheckedChange={(enabled) =>
            update.mutate({ id: trigger.id, input: { enabled } }, { onError })
          }
        />
        <Button size="sm" onClick={() => fire.mutate(trigger.id, { onError })}>
          <Play aria-hidden /> Run now
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete trigger"
          onClick={() => remove.mutate(trigger.id, { onError })}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {trigger.github && (
        <p className="font-mono text-code text-fg-muted">
          {trigger.github.repo} · {trigger.github.event}
          {trigger.github.label ? ` [${trigger.github.label}]` : ""} · next check{" "}
          {when(trigger.nextFireAt)}
        </p>
      )}
      {trigger.jira && (
        <p className="font-mono text-code text-fg-muted">
          {trigger.jira.jql} · next check {when(trigger.nextFireAt)}
        </p>
      )}
      {trigger.schedule && (
        <p className="font-mono text-code text-fg-muted">
          {trigger.schedule.cron} ({trigger.schedule.timezone}) · next {when(trigger.nextFireAt)}
        </p>
      )}
      <p className="text-sm text-fg-muted">
        Last fired {when(trigger.lastFiredAt)}
        {trigger.lastRunId && (
          <>
            {" · "}
            <Link
              to="/workflows/$workflowId/runs/$runId"
              params={{ workflowId, runId: trigger.lastRunId }}
              className="text-accent-ink hover:underline"
            >
              last run
            </Link>
          </>
        )}
      </p>
      {trigger.lastError && <p className="text-sm text-danger-ink">{trigger.lastError}</p>}
    </li>
  );
}
