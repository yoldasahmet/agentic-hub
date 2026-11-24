import type { ChatAttachment } from "@agentic/contracts";
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";
import { Link2 } from "lucide-react";
import { useState } from "react";

type Source = "github" | "jira";
const placeholders: Record<Source, string> = { github: "owner/repo#123", jira: "PROJ-123" };
const patterns: Record<Source, RegExp> = {
  github: /^[\w.-]+\/[\w.-]+#\d+$/,
  jira: /^[A-Z][A-Z0-9_]+-\d+$/,
};

/** Attaches a GitHub issue/PR or a Jira issue by reference; content is fetched once integrations land. */
export function ItemAttachButton({ onAdd }: { onAdd: (item: ChatAttachment) => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>("github");
  const [ref, setRef] = useState("");
  const valid = patterns[source].test(ref.trim());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Attach a GitHub or Jira item">
          <Link2 aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onAdd({ kind: "item", source, ref: ref.trim() });
            setRef("");
            setOpen(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="item-source">Item</Label>
            <div className="flex gap-2">
              <Select
                value={source}
                onValueChange={(v) => setSource(v === "jira" ? "jira" : "github")}
              >
                <SelectTrigger id="item-source" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="jira">Jira</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label="Reference"
                className="flex-1 font-mono text-code"
                placeholder={placeholders[source]}
                value={ref}
                onChange={(event) => setRef(event.target.value)}
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="primary" disabled={!valid}>
            Attach
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
