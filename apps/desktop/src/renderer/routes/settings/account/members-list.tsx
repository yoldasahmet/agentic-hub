import type { WorkspaceMember } from "@agentic/contracts";
import { Badge, Button } from "@agentic/ui";
import { showError } from "../../../lib/show-error";
import { useMembers, useRemoveMember, useSetRole } from "./queries";

/** Everyone in the workspace. Owners can promote, demote, and remove others. */
export function MembersList({ meId, isOwner }: { meId: string; isOwner: boolean }) {
  const members = useMembers().data ?? [];
  const setRole = useSetRole();
  const remove = useRemoveMember();
  const onError = (err: Error) => showError(err);
  const toggle = (m: WorkspaceMember) =>
    setRole.mutate(
      { userId: m.user.id, role: m.role === "owner" ? "member" : "owner" },
      { onError },
    );

  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface shadow-1">
      {members.map((m) => (
        <li key={m.user.id} className="flex items-center gap-3 px-4 py-3">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="truncate font-medium">
              {m.user.displayName}
              {m.user.id === meId && <span className="text-fg-muted"> (you)</span>}
            </p>
            <p className="truncate text-sm text-fg-muted" data-selectable>
              {m.user.email ?? "Local account, no sign-in yet"}
            </p>
          </div>
          <Badge tone={m.role === "owner" ? "accent" : "neutral"}>
            {m.role === "owner" ? "Owner" : "Member"}
          </Badge>
          {isOwner && m.user.id !== meId && (
            <>
              <Button size="sm" variant="ghost" onClick={() => toggle(m)}>
                {m.role === "owner" ? "Make member" : "Make owner"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate(m.user.id, { onError })}
              >
                Remove
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
