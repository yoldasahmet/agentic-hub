import { toast } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { ImportFileButton } from "../../lib/import-file-button";
import { showError } from "../../lib/show-error";
import { useImportAgent } from "./queries";

/** Imports an agent bundle from a .json, .yaml, or .yml file. */
export function ImportButton() {
  const navigate = useNavigate();
  const importAgent = useImportAgent();
  return (
    <ImportFileButton
      busy={importAgent.isPending}
      onImport={(file) =>
        importAgent.mutate(file, {
          onSuccess: (agent) => {
            toast.success(`Imported ${agent.name}`);
            void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } });
          },
          onError: (err) => showError(err),
        })
      }
    />
  );
}
