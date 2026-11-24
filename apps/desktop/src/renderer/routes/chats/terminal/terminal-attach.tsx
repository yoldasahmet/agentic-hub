import { Button, Label, Popover, PopoverContent, PopoverTrigger, TagListInput } from "@agentic/ui";
import { Paperclip } from "lucide-react";
import { useMcpServers, useSkills } from "../../settings/tools/queries";

export type TerminalAttachments = { mcpServers: string[]; skills: string[] };

/**
 * MCP servers and skills a terminal session starts with. The CLI asks
 * before each tool call itself, so nothing is pre-approved here.
 */
export function TerminalAttach({
  value,
  onChange,
}: {
  value: TerminalAttachments;
  onChange: (value: TerminalAttachments) => void;
}) {
  const servers = (useMcpServers().data ?? []).filter((s) => s.enabled).map((s) => s.name);
  const skills = (useSkills().data ?? []).map((s) => s.slug);
  const count = value.mcpServers.length + value.skills.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Paperclip aria-hidden /> {count ? `${count} attached` : "Attach"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-80 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="terminal-mcp">MCP servers</Label>
          <TagListInput
            id="terminal-mcp"
            suggestions={servers}
            value={value.mcpServers}
            onChange={(mcpServers) => onChange({ ...value, mcpServers })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="terminal-skills">Skills</Label>
          <TagListInput
            id="terminal-skills"
            suggestions={skills}
            value={value.skills}
            onChange={(next) => onChange({ ...value, skills: next })}
          />
        </div>
        <p className="text-xs text-fg-muted">
          Used by Claude Code (servers and skills) and Codex (servers).
        </p>
      </PopoverContent>
    </Popover>
  );
}
