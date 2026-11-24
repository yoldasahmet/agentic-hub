import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@agentic/ui";
import { useId, useState } from "react";
import { showError } from "../../lib/show-error";
import { useCreateJiraIssue, useIssueTypes } from "./queries";

const empty = { issueType: "", summary: "", description: "", parentKey: "" };

/** Creates an issue in the selected project; a parent key makes it a sub-task. */
export function CreateIssueDialog({
  projectKey,
  open,
  onOpenChange,
  onCreated,
}: {
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const id = useId();
  const types = useIssueTypes(open ? projectKey : undefined).data ?? [];
  const create = useCreateJiraIssue();
  const [form, setForm] = useState(empty);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const issueType = form.issueType || types.find((t) => !t.subtask)?.name || "";
  const isSubtask = types.find((t) => t.name === issueType)?.subtask ?? false;
  const submit = () =>
    create.mutate(
      {
        projectKey,
        issueType,
        summary: form.summary,
        description: form.description,
        parentKey: isSubtask && form.parentKey.trim() ? form.parentKey.trim() : undefined,
      },
      {
        onSuccess: (issue) => {
          setForm(empty);
          onOpenChange(false);
          onCreated(issue.key);
          toast.success(`Created ${issue.key}`);
        },
        onError: (err) => showError(err),
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New issue in {projectKey}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={issueType} onValueChange={(v) => set({ issueType: v })}>
                <SelectTrigger aria-label="Issue type">
                  <SelectValue placeholder="Loading…" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSubtask && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-parent`}>Parent issue</Label>
                <Input
                  id={`${id}-parent`}
                  className="font-mono text-code"
                  placeholder={`${projectKey}-1`}
                  value={form.parentKey}
                  onChange={(e) => set({ parentKey: e.target.value.toUpperCase() })}
                />
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-summary`}>Summary</Label>
            <Input
              id={`${id}-summary`}
              value={form.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
          </div>
          <Textarea
            aria-label="Description"
            placeholder="Description (Markdown)"
            rows={6}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={
                !form.summary.trim() ||
                !issueType ||
                (isSubtask && !form.parentKey.trim()) ||
                create.isPending
              }
              onClick={submit}
            >
              Create issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
