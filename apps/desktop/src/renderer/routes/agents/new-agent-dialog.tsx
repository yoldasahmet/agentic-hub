import { type AgentKind, defaultAgentSpec } from "@agentic/contracts";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { useCreateAgent } from "./queries";

/** Name and kind; everything else is edited in the agent's editor. */
export function NewAgentDialog() {
  const navigate = useNavigate();
  const create = useCreateAgent();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AgentKind>("llm");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus aria-hidden /> New agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              { name: name.trim(), spec: defaultAgentSpec(kind) },
              {
                onSuccess: (agent) => {
                  setOpen(false);
                  setName("");
                  void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } });
                },
                onError: (err) => showError(err),
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New agent</DialogTitle>
            <DialogDescription>
              You can change everything later; drafts save as you go.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-agent-name">Name</Label>
            <Input
              id="new-agent-name"
              autoFocus
              placeholder="e.g. Release Notes Writer"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-agent-kind">Kind</Label>
            <Select
              value={kind}
              onValueChange={(next) => setKind(next === "tool" || next === "human" ? next : "llm")}
            >
              <SelectTrigger id="new-agent-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llm">LLM: calls a model</SelectItem>
                <SelectItem value="tool">Tool: calls one tool</SelectItem>
                <SelectItem value="human">Human: asks a person</SelectItem>
              </SelectContent>
            </Select>
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
