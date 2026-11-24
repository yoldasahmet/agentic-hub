import type { AgentVersion, AgentVersionRef } from "@agentic/contracts";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@agentic/ui";

type Props = {
  versions: AgentVersion[];
  value: AgentVersionRef;
  onChange: (value: AgentVersionRef) => void;
};

/** The draft (as it is now) or a published version. */
export function VersionSelect({ versions, value, onChange }: Props) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="run-version">Version</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(next === "draft" ? "draft" : Number(next))}
      >
        <SelectTrigger id="run-version" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
          {versions.map((v) => (
            <SelectItem key={v.version} value={String(v.version)}>
              v{v.version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
