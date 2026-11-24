import { Button } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { useGithubStatus } from "../github/queries";
import { useJiraStatus } from "../jira/queries";
import { SetupStep, type StepState } from "./setup-step";

/** GitHub and Jira: who is connected, with a link to each settings page. */
export function IntegrationsStep() {
  const github = useGithubStatus();
  const jira = useJiraStatus();
  const githubUser = github.data?.login;
  const jiraUser = jira.data?.user?.displayName;
  const state: StepState =
    githubUser || jiraUser ? "done" : github.isPending || jira.isPending ? "checking" : "todo";
  const rows = [
    {
      name: "GitHub",
      detail: githubUser ? `Signed in as ${githubUser}` : "Not connected",
      to: "/settings/github",
    },
    {
      name: "Jira",
      detail: jiraUser ? `Signed in as ${jiraUser}` : "Not connected",
      to: "/settings/jira",
    },
  ] as const;
  return (
    <SetupStep
      number={3}
      title="GitHub and Jira"
      optional
      state={state}
      description="Connect them to browse issues and pull requests, give agents GitHub and Jira tools, and start workflows from new issues."
    >
      <ul className="divide-y divide-border rounded-card border border-border">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-3 px-4 py-2">
            <span className="font-medium">{row.name}</span>
            <span className="text-fg-muted">{row.detail}</span>
            <Button size="sm" variant="ghost" className="ml-auto" asChild>
              <Link to={row.to}>{row.detail === "Not connected" ? "Connect…" : "Settings…"}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </SetupStep>
  );
}
