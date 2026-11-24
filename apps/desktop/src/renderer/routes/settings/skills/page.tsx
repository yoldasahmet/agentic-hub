import type { Skill } from "@agentic/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  MarkdownText,
} from "@agentic/ui";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useDeleteSkill, useSkillPreview, useSkills } from "../tools/queries";
import { SkillForm } from "./skill-form";

type Open = { mode: "edit"; skill?: Skill } | { mode: "preview"; skill: Skill } | undefined;

export function SkillsPage() {
  const skills = useSkills();
  const remove = useDeleteSkill();
  const [open, setOpen] = useState<Open>();
  const preview = useSkillPreview(open?.mode === "preview" ? open.skill.id : undefined);
  return (
    <section className="grid gap-6">
      <header className="flex items-end gap-4">
        <div className="grid flex-1 gap-1">
          <h2 className="font-serif text-xl">Skills</h2>
          <p className="text-fg-muted">
            Reusable instructions. An agent with a skill gets it in its system prompt; a terminal
            session can start with skills too.
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen({ mode: "edit" })}>
          Add skill
        </Button>
      </header>
      <div className="rounded-card border border-border bg-surface shadow-1">
        {skills.data && skills.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {skills.data.map((skill) => (
              <li key={skill.id} className="flex items-center gap-3 px-4 py-2.5">
                <BookOpen aria-hidden className="size-4 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{skill.name}</p>
                  <p className="truncate font-mono text-xs text-fg-subtle" data-selectable>
                    {skill.slug} · {skill.source === "inline" ? "written here" : skill.path}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen({ mode: "preview", skill })}
                >
                  Preview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen({ mode: "edit", skill })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(skill.id, { onError: (err) => showError(err) })}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No skills yet"
            description="Write one here or point at a folder with a SKILL.md."
            className="py-10"
          />
        )}
      </div>
      <Dialog open={open !== undefined} onOpenChange={(next) => !next && setOpen(undefined)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {open?.mode === "preview"
                ? open.skill.name
                : open?.skill
                  ? `Edit ${open.skill.name}`
                  : "Add a skill"}
            </DialogTitle>
          </DialogHeader>
          {open?.mode === "edit" && (
            <SkillForm skill={open.skill} onDone={() => setOpen(undefined)} />
          )}
          {open?.mode === "preview" && (
            <div className="max-h-[60vh] overflow-y-auto" data-selectable>
              {preview.error ? (
                <p className="text-danger-ink">{preview.error.message}</p>
              ) : (
                <MarkdownText text={preview.data?.content ?? "…"} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
