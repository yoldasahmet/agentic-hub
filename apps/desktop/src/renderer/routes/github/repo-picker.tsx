import type { RepoRef } from "@agentic/client";
import { repoFullNameSchema } from "@agentic/contracts";
import { Input } from "@agentic/ui";
import { useEffect, useId, useState } from "react";
import { useRepos } from "./queries";

const STORAGE_KEY = "github.repo";

/** The last repo viewed, remembered per window (a convenience, so failures are ignored). */
export function useSelectedRepo(): [RepoRef | undefined, (fullName: string) => void] {
  const [fullName, setFullName] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const select = (next: string) => {
    setFullName(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };
  const valid = repoFullNameSchema.safeParse(fullName);
  const [owner = "", repo = ""] = valid.success ? valid.data.split("/") : [];
  return [valid.success ? { owner, repo } : undefined, select];
}

/** Type `owner/name` or pick one of the user's repos (native datalist). */
export function RepoPicker({
  value,
  onChange,
  enabled,
}: {
  value: RepoRef | undefined;
  onChange: (fullName: string) => void;
  enabled: boolean;
}) {
  const listId = useId();
  const repos = useRepos(enabled);
  const current = value ? `${value.owner}/${value.repo}` : "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  const commit = () => {
    if (repoFullNameSchema.safeParse(draft.trim()).success) onChange(draft.trim());
  };
  return (
    <>
      <Input
        aria-label="Repository"
        list={listId}
        className="w-72 font-mono text-code"
        placeholder="owner/name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <datalist id={listId}>
        {repos.data?.items.map((r) => (
          <option key={r.fullName} value={r.fullName}>
            {r.description ?? ""}
          </option>
        ))}
      </datalist>
    </>
  );
}
