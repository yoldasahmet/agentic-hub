import type { BundleFormat, Workflow } from "@agentic/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Archive, Copy, Download, MoreHorizontal } from "lucide-react";
import { downloadText } from "../../../lib/download";
import { showError } from "../../../lib/show-error";
import { useArchiveWorkflow, useDuplicateWorkflow, useExportWorkflow } from "../queries";

/** Export (JSON or YAML, with the agents it uses), duplicate, and archive. */
export function WorkflowMenu({ workflow }: { workflow: Workflow }) {
  const navigate = useNavigate();
  const exporter = useExportWorkflow();
  const duplicate = useDuplicateWorkflow();
  const archive = useArchiveWorkflow();
  const onError = (err: Error) => showError(err);
  const exportAs = (format: BundleFormat) =>
    exporter.mutate(
      { id: workflow.id, format },
      { onSuccess: (file) => downloadText(file.filename, file.content), onError },
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More actions">
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => exportAs("json")}>
          <Download aria-hidden /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportAs("yaml")}>
          <Download aria-hidden /> Export as YAML
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            duplicate.mutate(workflow.id, {
              onSuccess: (copy) =>
                void navigate({ to: "/workflows/$workflowId", params: { workflowId: copy.id } }),
              onError,
            })
          }
        >
          <Copy aria-hidden /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            archive.mutate(workflow.id, {
              onSuccess: () => {
                toast.success(`Archived ${workflow.name}`);
                void navigate({ to: "/workflows" });
              },
              onError,
            })
          }
        >
          <Archive aria-hidden /> Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
