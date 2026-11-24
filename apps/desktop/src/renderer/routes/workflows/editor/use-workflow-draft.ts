import {
  AppError,
  type ValidationIssue,
  type Workflow,
  type WorkflowDocument,
} from "@agentic/contracts";
import { toast } from "@agentic/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "../../../components/save-indicator";
import { useCore } from "../../../lib/core";
import { showError } from "../../../lib/show-error";
import { useDocHistory } from "./use-doc-history";

export type Identity = Pick<Workflow, "name" | "description" | "color" | "icon">;

const SAVE_DELAY_MS = 600;
const identityOf = ({ name, description, color, icon }: Workflow): Identity => ({
  name,
  description,
  color,
  icon,
});

/**
 * The editor's draft with autosave (D10), live validation (each save
 * returns the issues), and undo/redo of document edits. A conflict (another
 * window saved first) reloads the workflow.
 */
export function useWorkflowDraft(workflow: Workflow) {
  const core = useCore();
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState(() => identityOf(workflow));
  const history = useDocHistory(workflow.draft);
  const [state, setState] = useState<SaveState>("saved");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const revision = useRef(workflow.revision);
  const version = useRef(0);
  const saving = useRef(false);
  const latest = useRef({ identity, doc: history.doc });
  latest.current = { identity, doc: history.doc };

  useEffect(() => {
    void core?.client.workflows.validate(workflow.id).then(setIssues, () => undefined);
  }, [core, workflow.id]);

  const save = useCallback(async (): Promise<void> => {
    if (!core || saving.current) return;
    const snapshot = { ...latest.current, version: version.current };
    if (!snapshot.identity.name.trim()) return setState("invalid");
    saving.current = true;
    setState("saving");
    try {
      const saved = await core.client.workflows.update(workflow.id, {
        revision: revision.current,
        ...snapshot.identity,
        draft: snapshot.doc,
      });
      revision.current = saved.revision;
      setIssues(saved.issues);
      const { issues: _issues, ...fresh } = saved;
      queryClient.setQueryData(["core", core.key, "workflows", workflow.id], fresh);
      void queryClient.invalidateQueries({
        queryKey: ["core", core.key, "workflows"],
        exact: true,
      });
      if (version.current === snapshot.version) setState("saved");
      else setTimeout(() => void save(), SAVE_DELAY_MS);
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") {
        const fresh = await core.client.workflows.get(workflow.id);
        revision.current = fresh.revision;
        setIdentity(identityOf(fresh));
        history.reset(fresh.draft);
        toast.error("This workflow changed in another window; reloaded the latest draft.");
        setState("saved");
      } else {
        showError(err, "Could not save the draft");
        setState("error");
      }
    } finally {
      saving.current = false;
    }
  }, [core, workflow.id, queryClient, history.reset]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const touched = useCallback(() => {
    version.current += 1;
    setState("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [save]);

  const editDoc = useCallback(
    (next: WorkflowDocument, group?: string) => {
      history.push(next, group);
      touched();
    },
    [history.push, touched],
  );
  const step = (move: () => boolean) => {
    if (move()) touched();
  };

  return {
    identity,
    doc: history.doc,
    state,
    issues,
    revision: () => revision.current,
    editIdentity: (patch: Partial<Identity>) => {
      setIdentity((current) => ({ ...current, ...patch }));
      touched();
    },
    editDoc,
    undo: () => step(history.undo),
    redo: () => step(history.redo),
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
