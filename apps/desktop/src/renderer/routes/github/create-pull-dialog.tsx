import type { RepoRef } from "@agentic/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
  toast,
} from "@agentic/ui";
import { useId, useState } from "react";
import { showError } from "../../lib/show-error";
import { useCreatePull } from "./queries";

/** Opens a pull request from an existing branch (agents push theirs with github.push). */
export function CreatePullDialog({
  repo,
  defaultBase,
  open,
  onOpenChange,
  onCreated,
}: {
  repo: RepoRef;
  defaultBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (number: number) => void;
}) {
  const id = useId();
  const create = useCreatePull(repo);
  const [form, setForm] = useState({ title: "", body: "", head: "", base: "", draft: false });
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const submit = () =>
    create.mutate(
      { ...form, base: form.base || defaultBase },
      {
        onSuccess: (pull) => {
          onOpenChange(false);
          onCreated(pull.number);
          toast.success(`Opened #${pull.number}`);
        },
        onError: (err) => showError(err),
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New pull request</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-head`}>From branch</Label>
              <Input
                id={`${id}-head`}
                className="font-mono text-code"
                value={form.head}
                onChange={(e) => set({ head: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-base`}>Into</Label>
              <Input
                id={`${id}-base`}
                className="font-mono text-code"
                placeholder={defaultBase}
                value={form.base}
                onChange={(e) => set({ base: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <Textarea
            aria-label="Description"
            placeholder="Description (Markdown)"
            rows={6}
            value={form.body}
            onChange={(e) => set({ body: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Switch
              id={`${id}-draft`}
              checked={form.draft}
              onCheckedChange={(draft) => set({ draft })}
            />
            <Label htmlFor={`${id}-draft`}>Draft</Label>
            <Button
              className="ml-auto"
              variant="primary"
              disabled={!form.title.trim() || !form.head.trim() || create.isPending}
              onClick={submit}
            >
              Open pull request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
