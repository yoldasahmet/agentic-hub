import type { JiraStatus, JiraTransition } from "@agentic/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@agentic/ui";
import { ChevronDown } from "lucide-react";
import { showError } from "../../lib/show-error";
import { useJiraTransition } from "./queries";

/** The issue's status as a menu of the transitions its workflow allows from here. */
export function TransitionMenu({
  issueKey,
  status,
  transitions,
}: {
  issueKey: string;
  status: JiraStatus;
  transitions: JiraTransition[];
}) {
  const move = useJiraTransition(issueKey);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={move.isPending || transitions.length === 0}>
          {status.name} <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {transitions.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() =>
              move.mutate(t.id, {
                onSuccess: (issue) => toast.success(`${issue.key} is ${issue.status.name}`),
                onError: (err) => showError(err),
              })
            }
          >
            {t.name}
            {t.name !== t.to.name && <span className="text-fg-muted"> → {t.to.name}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
