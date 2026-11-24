import { jiraKeysIn, jiraKeysInBranch } from "@agentic/contracts";
import { Badge } from "@agentic/ui";
import { useJiraStatus } from "./queries";

/**
 * Jira keys named in a branch, title, or body, as links to the issues.
 * Shown only when Jira is connected (the same keys Core links PRs to).
 */
export function JiraKeyLinks({ branch, texts }: { branch: string; texts: string[] }) {
  const status = useJiraStatus().data;
  if (!status?.user) return null;
  const keys = [...new Set([...jiraKeysInBranch(branch), ...jiraKeysIn(...texts)])].slice(0, 10);
  if (keys.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
      Jira:
      {keys.map((key) => (
        <a key={key} href={`${status.siteUrl}/browse/${key}`} target="_blank" rel="noreferrer">
          <Badge tone="info">{key}</Badge>
        </a>
      ))}
    </p>
  );
}
