import type { Agent, BundleFormat } from "@agentic/contracts";
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
import { useArchiveAgent, useDuplicateAgent, useExportAgent } from "../queries";

/** Export (JSON or YAML), duplicate, and archive. */
export function AgentMenu({ agent }: { agent: Agent }) {
  const navigate = useNavigate();
  const exporter = useExportAgent();
  const duplicate = useDuplicateAgent();
  const archive = useArchiveAgent();
  const onError = (err: Error) => showError(err);
  const exportAs = (format: BundleFormat) =>
    exporter.mutate(
      { id: agent.id, format },
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
            duplicate.mutate(agent.id, {
              onSuccess: (copy) =>
                void navigate({ to: "/agents/$agentId", params: { agentId: copy.id } }),
              onError,
            })
          }
        >
          <Copy aria-hidden /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            archive.mutate(agent.id, {
              onSuccess: () => {
                toast.success(`Archived ${agent.name}`);
                void navigate({ to: "/agents" });
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
