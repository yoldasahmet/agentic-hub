import type { CreateTriggerInput, TriggerKind, Workflow } from "@agentic/contracts";
import {
  Button,
  type FormValue,
  Input,
  Label,
  SchemaForm,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  schemaDefaults,
} from "@agentic/ui";
import { useId, useState } from "react";
import { useWorkflowVersions } from "../queries";
import { type GithubTriggerDraft, GithubTriggerFields } from "./github-trigger-fields";
import { type JiraTriggerDraft, JiraTriggerFields } from "./jira-trigger-fields";

type Props = { workflow: Workflow; busy?: boolean; onSubmit: (input: CreateTriggerInput) => void };

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** A trigger: a name, by hand, on a cron schedule, or on GitHub or Jira activity, and its inputs. */
export function TriggerForm({ workflow, busy, onSubmit }: Props) {
  const id = useId();
  const versions = useWorkflowVersions(workflow.id).data ?? [];
  const latest = versions[0]?.document ?? workflow.draft;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TriggerKind>("manual");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState(localZone);
  const [input, setInput] = useState<FormValue>(() => schemaDefaults(latest.inputSchema));
  const fields = Object.keys(latest.inputSchema.properties ?? {});
  const [github, setGithub] = useState<GithubTriggerDraft>({
    repo: "",
    event: "issue.opened",
    label: "",
    itemField: fields.includes("task") ? "task" : (fields[0] ?? ""),
    repoField: fields.includes("repo") ? "repo" : "",
  });
  const [jira, setJira] = useState<JiraTriggerDraft>({
    jql: "",
    itemField: fields.includes("issue") ? "issue" : (fields[0] ?? ""),
    keyField: fields.includes("key") ? "key" : "",
  });
  return (
    <form
      className="grid gap-3 rounded-card border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          kind,
          name: name.trim(),
          input,
          version: "latest",
          schedule: kind === "schedule" ? { cron: cron.trim(), timezone } : undefined,
          github:
            kind === "github"
              ? {
                  repo: github.repo.trim(),
                  event: github.event,
                  label: github.label.trim() || undefined,
                  itemField: github.itemField,
                  repoField: github.repoField || undefined,
                }
              : undefined,
          jira:
            kind === "jira"
              ? {
                  jql: jira.jql.trim(),
                  itemField: jira.itemField,
                  keyField: jira.keyField || undefined,
                }
              : undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            placeholder="e.g. Weekday morning"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Starts</Label>
          <Select
            value={kind}
            onValueChange={(v) =>
              setKind(v === "schedule" || v === "github" || v === "jira" ? v : "manual")
            }
          >
            <SelectTrigger aria-label="Kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">By hand (Run now)</SelectItem>
              <SelectItem value="schedule">On a schedule</SelectItem>
              <SelectItem value="github">On GitHub activity</SelectItem>
              <SelectItem value="jira">On Jira issues (JQL)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {kind === "schedule" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-cron`}>Cron (min hour day month weekday)</Label>
            <Input
              id={`${id}-cron`}
              className="font-mono text-code"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-tz`}>Time zone</Label>
            <Input id={`${id}-tz`} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
        </div>
      )}
      {kind === "github" && (
        <GithubTriggerFields value={github} onChange={setGithub} inputFields={fields} />
      )}
      {kind === "jira" && (
        <JiraTriggerFields value={jira} onChange={setJira} inputFields={fields} />
      )}
      <p className="text-sm text-fg-muted">Runs the latest published version with these inputs:</p>
      <SchemaForm
        schema={latest.inputSchema}
        value={input}
        onChange={setInput}
        emptyHint="No inputs."
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
          Add trigger
        </Button>
      </div>
    </form>
  );
}
