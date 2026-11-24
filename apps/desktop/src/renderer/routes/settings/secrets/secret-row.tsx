import type { SecretMeta } from "@agentic/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@agentic/ui";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useDeleteSecret } from "./queries";
import { SecretForm } from "./secret-form";

type Mode = "idle" | "replace" | "delete";

export function SecretRow({ secret }: { secret: SecretMeta }) {
  const [mode, setMode] = useState<Mode>("idle");
  const remove = useDeleteSecret();
  const close = () => setMode("idle");

  const confirmDelete = () =>
    remove.mutate(secret.name, {
      onSuccess: () => {
        toast.success(`Deleted ${secret.name}`);
        close();
      },
      onError: (err) => showError(err),
    });

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <KeyRound aria-hidden className="size-4 text-fg-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-code" data-selectable>
          {secret.name}
        </p>
        <p className="text-xs text-fg-subtle">
          Updated {new Date(secret.updatedAt).toLocaleString()}
        </p>
      </div>
      {secret.managed ? (
        <span className="text-xs text-fg-subtle">Managed by the app</span>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setMode("replace")}>
            Replace
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("delete")}>
            Delete
          </Button>
        </>
      )}

      <Dialog open={mode !== "idle"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "delete" ? "Delete secret?" : "Replace secret"}</DialogTitle>
            <DialogDescription className="font-mono text-code">{secret.name}</DialogDescription>
          </DialogHeader>
          {mode === "replace" && <SecretForm name={secret.name} onDone={close} />}
          {mode === "delete" && (
            <DialogFooter>
              <Button onClick={close}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={remove.isPending}>
                Delete
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </li>
  );
}
