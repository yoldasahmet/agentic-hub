import type { Agent } from "@agentic/contracts";
import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@agentic/ui";
import { Upload } from "lucide-react";
import { IdentityPicker } from "../../../components/identity-picker";
import { SaveIndicator } from "../../../components/save-indicator";
import { showError } from "../../../lib/show-error";
import { Playground } from "../playground/playground";
import { usePublishAgent } from "../queries";
import { AgentMenu } from "./agent-menu";
import { IoTab } from "./io-tab";
import { PromptTab } from "./prompt-tab";
import { RuntimeTab } from "./runtime-tab";
import { draftProblem, useAgentDraft } from "./use-agent-draft";

/** One agent: identity, I/O, prompt, runtime, and the playground. Drafts autosave; publishing is explicit. */
export function AgentEditor({ agent }: { agent: Agent }) {
  const { draft, state, revision, edit, editSpec } = useAgentDraft(agent);
  const publish = usePublishAgent();
  const spec = draft.spec;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IdentityPicker color={draft.color} icon={draft.icon} onChange={(patch) => edit(patch)} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Input
            aria-label="Agent name"
            className="h-8 border-transparent bg-transparent px-1 font-serif text-lg hover:border-border-input"
            value={draft.name}
            onChange={(event) => edit({ name: event.target.value })}
          />
          <Input
            aria-label="Description"
            placeholder="What this agent does"
            className="h-7 border-transparent bg-transparent px-1 text-fg-muted hover:border-border-input"
            value={draft.description}
            onChange={(event) => edit({ description: event.target.value })}
          />
        </div>
        <SaveIndicator state={state} problem={draftProblem(draft)} />
        <Badge>{agent.latestVersion ? `v${agent.latestVersion} published` : "Not published"}</Badge>
        <Button
          variant="primary"
          disabled={state !== "saved" || publish.isPending}
          onClick={() =>
            publish.mutate(
              { id: agent.id, revision: revision() },
              {
                onSuccess: (v) => toast.success(`Published v${v.version}`),
                onError: (err) => showError(err),
              },
            )
          }
        >
          <Upload aria-hidden /> Publish
        </Button>
        <AgentMenu agent={agent} />
      </header>
      <Tabs defaultValue="io" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-4">
          <TabsTrigger value="io">Inputs &amp; outputs</TabsTrigger>
          <TabsTrigger value="prompt">{spec.kind === "human" ? "Question" : "Prompt"}</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <TabsContent value="io">
            <IoTab
              inputs={draft.inputs}
              outputs={draft.outputs}
              format={spec.outputFormat}
              onInputs={(inputs) => edit({ inputs })}
              onOutputs={(outputs) => edit({ outputs })}
              onFormat={(outputFormat) => editSpec({ outputFormat })}
            />
          </TabsContent>
          <TabsContent value="prompt">
            <PromptTab
              prompt={spec.prompt}
              inputs={draft.inputs}
              human={spec.kind === "human"}
              onChange={(prompt) => editSpec({ prompt })}
            />
          </TabsContent>
          <TabsContent value="runtime">
            <RuntimeTab spec={spec} inputs={draft.inputs} onChange={editSpec} />
          </TabsContent>
          <TabsContent value="playground">
            <Playground agent={agent} draftSaved={state === "saved"} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
