import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { useCreateWorkflow } from "./queries";

/** A name is enough; the graph is built in the editor and saves as you go. */
export function NewWorkflowDialog() {
  const navigate = useNavigate();
  const create = useCreateWorkflow();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus aria-hidden /> New workflow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              { name: name.trim() },
              {
                onSuccess: (workflow) => {
                  setOpen(false);
                  setName("");
                  void navigate({
                    to: "/workflows/$workflowId",
                    params: { workflowId: workflow.id },
                  });
                },
                onError: (err) => showError(err),
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Compose agents into a graph with branches, loops, and gates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-workflow-name">Name</Label>
            <Input
              id="new-workflow-name"
              autoFocus
              placeholder="e.g. Ship a fix"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
