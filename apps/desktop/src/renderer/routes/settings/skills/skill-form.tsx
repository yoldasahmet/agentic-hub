import { type Skill, type SkillInput, skillInputSchema } from "@agentic/contracts";
import {
  Button,
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
import { FolderOpen } from "lucide-react";
import { useId, useState } from "react";
import { invoke } from "../../../lib/bridge";
import { showError } from "../../../lib/show-error";
import { useSaveSkill } from "../tools/queries";

/** Add or edit a skill: Markdown kept in the app, or a folder with a SKILL.md. */
export function SkillForm({ skill, onDone }: { skill?: Skill; onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState(skill?.name ?? "");
  const [slug, setSlug] = useState(skill?.slug ?? "");
  const [source, setSource] = useState(skill?.source ?? "inline");
  const [content, setContent] = useState(skill?.content ?? "");
  const [path, setPath] = useState(skill?.path ?? "");
  const save = useSaveSkill();
  const submit = () => {
    const raw: SkillInput =
      source === "inline"
        ? { source, name, slug: slug || undefined, content }
        : { source, name, slug: slug || undefined, path };
    const parsed = skillInputSchema.safeParse(raw);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid skill");
    save.mutate(
      { id: skill?.id, value: parsed.data },
      { onSuccess: onDone, onError: (err) => showError(err) },
    );
  };
  const browse = async () => {
    const { path: picked } = await invoke("dialog.openDirectory", {
      defaultPath: path || undefined,
    });
    if (picked) setPath(picked);
  };
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-3">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Release notes"
          />
        </div>
        <div className="grid w-48 gap-1.5">
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <Input
            id={`${id}-slug`}
            className="font-mono text-code"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="from the name"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-source`}>Source</Label>
        <Select
          value={source}
          onValueChange={(v) => setSource(v === "directory" ? "directory" : "inline")}
        >
          <SelectTrigger id={`${id}-source`} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inline">Written here</SelectItem>
            <SelectItem value="directory">Folder with SKILL.md</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {source === "inline" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-content`}>Instructions (Markdown)</Label>
          <Textarea
            id={`${id}-content`}
            className="min-h-48 font-mono text-code"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-path`}>Folder</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-path`}
              className="flex-1 font-mono text-code"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/me/skills/release-notes"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Choose a folder"
              onClick={browse}
            >
              <FolderOpen aria-hidden />
            </Button>
          </div>
          <p className="text-sm text-fg-muted">SKILL.md is read each time the skill is used.</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
