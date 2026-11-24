import { type AgentKind, type AgentSpec, agentKindSchema, type IoField } from "@agentic/contracts";
import {
  Input,
  Label,
  ModelChainPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";
import { providerNames, useModels, useProviders } from "../../settings/providers/queries";
import { useToolCatalog } from "../../settings/tools/queries";
import { CapabilitySlots } from "./capability-slots";
import { WorkingDirField } from "./working-dir-field";

const kindLabels: Record<AgentKind, { label: string; hint: string }> = {
  llm: { label: "LLM", hint: "Renders the prompt, calls a model, and checks the answer." },
  tool: { label: "Tool", hint: "Calls one tool with its inputs." },
  human: { label: "Human", hint: "Asks a person at a gate and checks their answer." },
};

type Props = {
  spec: AgentSpec;
  inputs: IoField[];
  onChange: (patch: Partial<AgentSpec>) => void;
};

/** Kind, model chain, working dir, limits, and tool/MCP/skill slots. */
export function RuntimeTab({ spec, inputs, onChange }: Props) {
  const models = useModels().data ?? [];
  const names = providerNames(useProviders().data);
  const tools = useToolCatalog().data?.tools ?? [];
  const runtime = spec.runtime;
  const setRuntime = (patch: Partial<AgentSpec["runtime"]>) =>
    onChange({ runtime: { ...runtime, ...patch } });

  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-1.5">
        <Label htmlFor="agent-kind">Kind</Label>
        <Select
          value={spec.kind}
          onValueChange={(next) => {
            const kind = agentKindSchema.safeParse(next);
            if (kind.success) onChange({ kind: kind.data });
          }}
        >
          <SelectTrigger id="agent-kind" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(kindLabels).map(([kind, { label }]) => (
              <SelectItem key={kind} value={kind}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-fg-muted">{kindLabels[spec.kind].hint}</p>
      </div>
      {spec.kind === "llm" && (
        <>
          <ModelChainPicker
            models={models}
            providerNames={names}
            model={runtime.model}
            reasoning={runtime.reasoning}
            fallbacks={runtime.fallbacks}
            onChange={(chain) => setRuntime(chain)}
          />
          <WorkingDirField
            policy={runtime.workingDir}
            inputs={inputs}
            onChange={(workingDir) => setRuntime({ workingDir })}
          />
          <div className="flex gap-4">
            <NumberField
              id="timeout"
              label="Timeout (seconds)"
              value={Math.round(runtime.timeoutMs / 1000)}
              min={10}
              max={3600}
              onChange={(seconds) => setRuntime({ timeoutMs: seconds * 1000 })}
            />
            <NumberField
              id="repairs"
              label="Repair rounds"
              value={runtime.maxRepairs}
              min={0}
              max={3}
              onChange={(maxRepairs) => setRuntime({ maxRepairs })}
            />
          </div>
        </>
      )}
      {spec.kind === "tool" && (
        <div className="grid gap-1.5">
          <Label htmlFor="tool-name">Tool</Label>
          <Input
            id="tool-name"
            className="w-72 font-mono text-code"
            placeholder="e.g. git.status"
            list="agent-tool-names"
            value={runtime.tool ?? ""}
            onChange={(event) => setRuntime({ tool: event.target.value || undefined })}
          />
          <datalist id="agent-tool-names">
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.title}
              </option>
            ))}
          </datalist>
        </div>
      )}
      {spec.kind !== "human" && (
        <CapabilitySlots
          value={spec.capabilities}
          onChange={(capabilities) => onChange({ capabilities })}
        />
      )}
    </div>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="number"
        className="w-32"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next)) props.onChange(Math.min(Math.max(next, props.min), props.max));
        }}
      />
    </div>
  );
}
