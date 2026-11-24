import {
  Button,
  EmptyState,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { GitPullRequest } from "lucide-react";
import { useState } from "react";
import { CreatePullDialog } from "./create-pull-dialog";
import { IssueDetail } from "./issue-detail";
import { ItemList, type ListItem } from "./item-list";
import { PullDetail } from "./pull-detail";
import { type ItemState, useGithubStatus, useIssues, usePulls, useRepoInfo } from "./queries";
import { RepoPicker, useSelectedRepo } from "./repo-picker";

type Kind = "issues" | "pulls";

/** GitHub: a repo's issues and pull requests, their conversations, diffs, and reviews. */
export function GithubPage() {
  const status = useGithubStatus();
  const connected = status.data?.login != null;
  const [repo, setRepo] = useSelectedRepo();
  const [kind, setKind] = useState<Kind>("issues");
  const [state, setState] = useState<ItemState>("open");
  const [selected, setSelected] = useState<number>();
  const [creating, setCreating] = useState(false);
  const issues = useIssues(kind === "issues" && connected ? repo : undefined, state);
  const pulls = usePulls(kind === "pulls" && connected ? repo : undefined, state);
  const info = useRepoInfo(connected ? repo : undefined);
  const items: ListItem[] =
    kind === "issues"
      ? (issues.data?.items ?? []).map((item) => ({ kind: "issue", item }))
      : (pulls.data?.items ?? []).map((item) => ({ kind: "pull", item }));
  const error = (kind === "issues" ? issues : pulls).error;
  const pick = (fullName: string) => {
    setRepo(fullName);
    setSelected(undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="flex-1 font-serif text-lg">GitHub</h1>
        {connected && <RepoPicker value={repo} onChange={pick} enabled={connected} />}
        {connected && repo && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New pull request
          </Button>
        )}
      </header>
      {!connected ? (
        <EmptyState
          icon={GitPullRequest}
          title={status.isLoading ? "Checking GitHub…" : "Connect GitHub"}
          description={
            status.data?.error ??
            "Add a token, sign in with a device code, or run `gh auth login`, then pick a repo."
          }
          action={
            <Button asChild>
              <Link to="/settings/github">Open GitHub settings</Link>
            </Button>
          }
        />
      ) : !repo ? (
        <EmptyState
          icon={GitPullRequest}
          title="Pick a repository"
          description="Type owner/name or choose one of your repos above."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[22rem_1fr]">
          <div className="flex min-h-0 flex-col border-r border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border p-2">
              <Tabs
                value={kind}
                onValueChange={(v) => {
                  setKind(v === "pulls" ? "pulls" : "issues");
                  setSelected(undefined);
                }}
              >
                <TabsList>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                  <TabsTrigger value="pulls">Pull requests</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={state} onValueChange={(v: ItemState) => setState(v)}>
                <SelectTrigger aria-label="State" className="ml-auto w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {error ? (
                <p className="p-3 text-sm text-danger-ink">{error.message}</p>
              ) : (
                <ItemList items={items} selected={selected} onSelect={setSelected} />
              )}
            </ScrollArea>
          </div>
          <ScrollArea className="min-h-0">
            {selected === undefined ? (
              <EmptyState
                icon={GitPullRequest}
                title={kind === "issues" ? "Pick an issue" : "Pick a pull request"}
                description="Its conversation, diff, and review tools open here."
              />
            ) : kind === "issues" ? (
              <IssueDetail key={selected} repo={repo} number={selected} />
            ) : (
              <PullDetail key={selected} repo={repo} number={selected} />
            )}
          </ScrollArea>
        </div>
      )}
      {repo && (
        <CreatePullDialog
          repo={repo}
          defaultBase={info.data?.defaultBranch ?? "main"}
          open={creating}
          onOpenChange={setCreating}
          onCreated={(number) => {
            setKind("pulls");
            setSelected(number);
          }}
        />
      )}
    </div>
  );
}
