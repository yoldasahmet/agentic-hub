import {
  type Agent,
  type AgentSpec,
  AppError,
  fieldsToSchema,
  type IoField,
  schemaToFields,
} from "@agentic/contracts";
import { fieldIssues, toast } from "@agentic/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "../../../components/save-indicator";
import { useCore } from "../../../lib/core";
import { showError } from "../../../lib/show-error";

/** What the editor edits: identity, the spec, and I/O as fields (names may be mid-edit). */
export type DraftState = Pick<Agent, "name" | "description" | "color" | "icon"> & {
  spec: AgentSpec;
  inputs: IoField[];
  outputs: IoField[];
};

const SAVE_DELAY_MS = 600;

const fromAgent = (agent: Agent): DraftState => ({
  name: agent.name,
  description: agent.description,
  color: agent.color,
  icon: agent.icon,
  spec: agent.draft,
  inputs: schemaToFields(agent.draft.inputSchema),
  outputs: schemaToFields(agent.draft.outputSchema),
});

/** Why the draft can't be saved yet, or undefined when it can. */
export function draftProblem(draft: DraftState): string | undefined {
  if (!draft.name.trim()) return "Give the agent a name";
  if (fieldIssues(draft.inputs).size > 0) return "Fix the input fields";
  if (fieldIssues(draft.outputs).size > 0) return "Fix the output fields";
  const dir = draft.spec.runtime.workingDir;
  if ((dir.mode === "fixed" && !dir.path) || (dir.mode === "input" && !dir.field)) {
    return "Choose the working directory";
  }
  return undefined;
}

/**
 * The editor's local draft with autosave (D10): edits save after a short
 * pause at the last known revision. Edits made during a save are saved
 * next, and a conflict (another window saved first) reloads the agent.
 */
export function useAgentDraft(agent: Agent) {
  const core = useCore();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => fromAgent(agent));
  const [state, setState] = useState<SaveState>("saved");
  const revision = useRef(agent.revision);
  const version = useRef(0);
  const saving = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;

  // Reads the draft through a ref, so it stays stable and can re-run itself.
  const save = useCallback(async (): Promise<void> => {
    if (!core || saving.current) return;
    const snapshot = { draft: latest.current, version: version.current };
    const problem = draftProblem(snapshot.draft);
    if (problem) return setState("invalid");
    saving.current = true;
    setState("saving");
    try {
      const { inputs, outputs, spec, ...identity } = snapshot.draft;
      const saved = await core.client.agents.update(agent.id, {
        revision: revision.current,
        ...identity,
        draft: {
          ...spec,
          inputSchema: fieldsToSchema(inputs),
          outputSchema: fieldsToSchema(outputs),
        },
      });
      revision.current = saved.revision;
      queryClient.setQueryData(["core", core.key, "agents", agent.id], saved);
      void queryClient.invalidateQueries({ queryKey: ["core", core.key, "agents"], exact: true });
      if (version.current === snapshot.version) setState("saved");
      else setTimeout(() => void save(), SAVE_DELAY_MS);
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") {
        const fresh = await core.client.agents.get(agent.id);
        revision.current = fresh.revision;
        setDraft(fromAgent(fresh));
        toast.error("This agent changed in another window; reloaded the latest draft.");
        setState("saved");
      } else {
        showError(err, "Could not save the draft");
        setState("error");
      }
    } finally {
      saving.current = false;
    }
  }, [core, agent.id, queryClient]);

  // Each edit restarts the pause; a save in flight picks up later edits when it ends.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = useCallback(
    (next: (current: DraftState) => DraftState) => {
      version.current += 1;
      setDraft(next);
      setState("pending");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save],
  );

  const edit = useCallback(
    (patch: Partial<DraftState>) => update((current) => ({ ...current, ...patch })),
    [update],
  );
  const editSpec = useCallback(
    (patch: Partial<AgentSpec>) =>
      update((current) => ({ ...current, spec: { ...current.spec, ...patch } })),
    [update],
  );

  return { draft, state, revision: () => revision.current, edit, editSpec, saveNow: save };
}
