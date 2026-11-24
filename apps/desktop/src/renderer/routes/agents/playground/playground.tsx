import {
  type Agent,
  type AgentVersionRef,
  AppError,
  type ModelRef,
  parseAgentAssistantId,
} from "@agentic/contracts";
import {
  Button,
  type FormValue,
  KeyHint,
  Label,
  ModelPicker,
  SchemaForm,
  schemaDefaults,
} from "@agentic/ui";
import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { showError } from "../../../lib/show-error";
import { providerNames, useModels, useProviders } from "../../settings/providers/queries";
import { useAgentRuns, useAgentVersions, useRunAgent } from "../queries";
import { RunList } from "./run-list";
import { RunResult } from "./run-result";
import { SavedInputs } from "./saved-inputs";
import { VersionSelect } from "./version-select";

const issuesSchema = z.object({ issues: z.array(z.string()) });

/**
 * Try an agent: pick the draft or a version, optionally another model,
 * fill its inputs, and watch the run. ⌘↵ runs.
 */
export function Playground({ agent, draftSaved }: { agent: Agent; draftSaved: boolean }) {
  const versions = useAgentVersions(agent.id).data ?? [];
  const runs = useAgentRuns(agent.id).data ?? [];
  const models = useModels().data ?? [];
  const names = providerNames(useProviders().data);
  const runAgent = useRunAgent();
  const [version, setVersion] = useState<AgentVersionRef>("draft");
  const spec =
    version === "draft" ? agent.draft : versions.find((v) => v.version === version)?.spec;
  const [input, setInput] = useState<FormValue>(() => schemaDefaults(agent.draft.inputSchema));
  const [model, setModel] = useState<ModelRef>();
  const [issues, setIssues] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const current = runs.find((r) => r.id === selected) ?? runs[0];
  const currentSpec =
    !current || parseAgentAssistantId(current.assistantId)?.draft
      ? agent.draft
      : (versions.find((v) => v.version === current.assistantVersion)?.spec ?? agent.draft);

  const blocked = version === "draft" && !draftSaved;
  const run = () => {
    if (blocked || !spec) return;
    runAgent.mutate(
      { id: agent.id, input: { version, input, model } },
      {
        onSuccess: (started) => {
          setIssues([]);
          setSelected(started.id);
        },
        onError: (err) => {
          const details = err instanceof AppError ? issuesSchema.safeParse(err.details) : undefined;
          setIssues(details?.success ? details.data.issues : []);
          showError(err);
        },
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(20rem,26rem)_1fr]">
      <form
        className="grid content-start gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            run();
          }
        }}
      >
        <div className="flex flex-wrap gap-3">
          <VersionSelect versions={versions} value={version} onChange={setVersion} />
          <div className="grid min-w-56 flex-1 gap-1.5">
            <Label htmlFor="override-model">Model</Label>
            <div className="flex gap-1">
              <ModelPicker
                id="override-model"
                models={models}
                value={model}
                providerNames={names}
                placeholder="The agent's model"
                onChange={setModel}
              />
              {model && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Use the agent's model"
                  onClick={() => setModel(undefined)}
                >
                  <RotateCcw aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
        <SavedInputs agentId={agent.id} value={input} onLoad={setInput} />
        {spec && (
          <SchemaForm
            schema={spec.inputSchema}
            value={input}
            onChange={setInput}
            issues={issues}
            emptyHint="This agent takes no inputs."
          />
        )}
        <div className="flex items-center justify-end gap-2">
          {blocked && <span className="text-sm text-fg-muted">Saving the draft first…</span>}
          <KeyHint keys={["⌘", "↵"]} />
          <Button type="submit" variant="primary" disabled={runAgent.isPending || !spec || blocked}>
            <Play aria-hidden /> Run
          </Button>
        </div>
      </form>
      <div className="grid min-w-0 content-start gap-4">
        <RunList runs={runs} selectedId={current?.id} onSelect={setSelected} />
        {current ? (
          <RunResult key={current.id} run={current} spec={currentSpec} />
        ) : (
          <p className="text-fg-muted">Runs appear here with their live events and output.</p>
        )}
      </div>
    </div>
  );
}
