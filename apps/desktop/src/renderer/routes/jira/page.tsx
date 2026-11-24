import { Button, EmptyState, ScrollArea } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { SquareKanban } from "lucide-react";
import { useState } from "react";
import { CreateIssueDialog } from "./create-issue-dialog";
import { IssueDetail } from "./issue-detail";
import { IssueList } from "./issue-list";
import { JqlBar } from "./jql-bar";
import { ProjectPicker, projectJql, useSelectedProject } from "./project-picker";
import { useJiraSearch, useJiraStatus } from "./queries";

/** Jira: a project's issues by JQL, an issue's conversation and transitions, and new issues. */
export function JiraPage() {
  const status = useJiraStatus();
  const connected = status.data?.user != null;
  const [project, setProject] = useSelectedProject();
  const [jql, setJql] = useState(() => projectJql(project));
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const search = useJiraSearch(jql, connected);
  const pick = (key: string | undefined) => {
    setProject(key);
    setJql(projectJql(key));
    setSelected(undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="flex-1 font-serif text-lg">Jira</h1>
        {connected && <ProjectPicker value={project} onChange={pick} />}
        {connected && project && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New issue
          </Button>
        )}
      </header>
      {!connected ? (
        <EmptyState
          icon={SquareKanban}
          title={status.isLoading ? "Checking Jira…" : "Connect Jira"}
          description={
            status.data?.error ?? "Add your Jira site, account email, and an API token in Settings."
          }
          action={
            <Button asChild>
              <Link to="/settings/jira">Open Jira settings</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[24rem_1fr]">
          <div className="flex min-h-0 flex-col border-r border-border bg-surface">
            <JqlBar value={jql} onSearch={setJql} />
            <ScrollArea className="min-h-0 flex-1">
              {search.error ? (
                <p className="p-3 text-sm text-danger-ink">{search.error.message}</p>
              ) : search.data?.items.length === 0 ? (
                <p className="p-3 text-sm text-fg-muted">No issues match.</p>
              ) : (
                <IssueList
                  issues={search.data?.items ?? []}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </ScrollArea>
          </div>
          <ScrollArea className="min-h-0">
            {selected === undefined ? (
              <EmptyState
                icon={SquareKanban}
                title="Pick an issue"
                description="Its description, comments, and transitions open here."
              />
            ) : (
              <IssueDetail key={selected} issueKey={selected} onOpen={setSelected} />
            )}
          </ScrollArea>
        </div>
      )}
      {project && (
        <CreateIssueDialog
          projectKey={project}
          open={creating}
          onOpenChange={setCreating}
          onCreated={setSelected}
        />
      )}
    </div>
  );
}
