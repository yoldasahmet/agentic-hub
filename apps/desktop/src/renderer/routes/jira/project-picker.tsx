import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@agentic/ui";
import { useState } from "react";
import { useJiraProjects } from "./queries";

const STORAGE_KEY = "jira.project";
const ALL = "__all";

/** The last project viewed, remembered per window (a convenience, so failures are ignored). */
export function useSelectedProject(): [string | undefined, (key: string | undefined) => void] {
  const [key, setKey] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const select = (next: string | undefined) => {
    setKey(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };
  return [key, select];
}

/** The default query for a project: its open work, recently updated first. */
export function projectJql(key: string | undefined): string {
  const scope = key ? `project = ${key} AND ` : "";
  return `${scope}statusCategory != Done ORDER BY updated DESC`;
}

/** Picks a project (or all of them) from the ones the account can browse. */
export function ProjectPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string | undefined) => void;
}) {
  const projects = useJiraProjects(true).data?.items ?? [];
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger aria-label="Project" className="w-60">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All projects</SelectItem>
        {value && !projects.some((p) => p.key === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {projects.map((p) => (
          <SelectItem key={p.key} value={p.key}>
            {p.name} ({p.key})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
