import type { AgentSpec, Run } from "@agentic/contracts";
import { Button, EventStream, OutputView, StatusPill, UsageSummary } from "@agentic/ui";
import { Pencil, Square } from "lucide-react";
import { useState } from "react";
import { useCoreMutation } from "../../../lib/core-queries";
import { showError } from "../../../lib/show-error";
import { useRunEvents } from "../../../lib/use-run-events";
import { providerNames, useProviders } from "../../settings/providers/queries";
import { useEditOutput, useResumeRun, useThreadState } from "../queries";
import { AnswerForm } from "./answer-form";
import { runLabel } from "./run-label";
import { readAgentState } from "./run-output";

type Props = { run: Run; spec: AgentSpec };

/** One playground run: live events, the rendered output (editable), usage, and its gate. */
export function RunResult({ run, spec }: Props) {
  const events = useRunEvents(run.id);
  const names = providerNames(useProviders().data);
  const { output, report, gate } = readAgentState(useThreadState(run.threadId).data);
  const [editing, setEditing] = useState(false);
  const edit = useEditOutput();
  const resume = useResumeRun();
  const cancel = useCoreMutation((c, runId: string) => c.runs.cancel(runId));
  const active = run.status === "queued" || run.status === "running";
  const onError = (err: Error) => showError(err);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <StatusPill status={run.status} />
        <span className="text-fg-muted">{runLabel(run)}</span>
        {report?.model && (
          <span className="text-fg-muted">
            · {names[report.model.providerId] ?? report.model.providerId} · {report.model.model}
          </span>
        )}
        <span className="flex-1" />
        {active && (
          <Button size="sm" onClick={() => cancel.mutate(run.id, { onError })}>
            <Square aria-hidden /> Stop
          </Button>
        )}
      </header>
      {run.error && <p className="text-danger-ink">{run.error.message}</p>}
      {gate && run.status === "waiting" && (
        <section className="grid gap-3 rounded-card border border-warning bg-warning-tint p-4">
          <p className="font-serif text-prose">{gate.question}</p>
          {gate.issues.length > 0 && (
            <p className="text-sm text-danger-ink">
              The last answer didn't fit: {gate.issues.join("; ")}
            </p>
          )}
          <AnswerForm
            schema={gate.outputSchema}
            submitLabel="Send answer"
            busy={resume.isPending}
            onSubmit={(value) => resume.mutate({ runId: run.id, resume: value }, { onError })}
          />
        </section>
      )}
      {output && !editing && (
        <section className="grid gap-3 rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 font-serif text-lg">Output</h3>
            {!active && run.status !== "waiting" && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
            )}
          </div>
          <OutputView format={spec.outputFormat} value={output} schema={spec.outputSchema} />
          {report?.model && (
            <UsageSummary
              usage={report.usage}
              costUsd={report.costUsd}
              durationMs={report.durationMs}
            />
          )}
        </section>
      )}
      {output && editing && (
        <section className="grid gap-3 rounded-card border border-border bg-surface p-4">
          <h3 className="font-serif text-lg">Edit output</h3>
          <AnswerForm
            schema={spec.outputSchema}
            initial={output}
            submitLabel="Save as new checkpoint"
            busy={edit.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(value) => {
              const next = typeof value === "object" && value && !Array.isArray(value) ? value : {};
              edit.mutate(
                { threadId: run.threadId, output: next },
                { onSuccess: () => setEditing(false), onError },
              );
            }}
          />
        </section>
      )}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-fg-muted">Events</h3>
        <EventStream events={events} providerNames={names} />
      </section>
    </div>
  );
}
