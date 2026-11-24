import { Button, Input } from "@agentic/ui";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

/** A JQL query box: Enter or Search runs it. Edits stay local until then. */
export function JqlBar({ value, onSearch }: { value: string; onSearch: (jql: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const run = () => draft.trim() && onSearch(draft.trim());
  return (
    <div className="flex gap-2 border-b border-border p-2">
      <Input
        aria-label="JQL"
        className="flex-1 font-mono text-code"
        placeholder="project = ABC AND statusCategory != Done"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && run()}
      />
      <Button size="icon" aria-label="Search" onClick={run}>
        <Search aria-hidden />
      </Button>
    </div>
  );
}
