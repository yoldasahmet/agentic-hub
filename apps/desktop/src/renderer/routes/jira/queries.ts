import type { CreateJiraIssueInput, JiraConnectionTest, JiraSettings } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export function useJiraStatus() {
  return useCoreQuery(["jira", "status"], (c) => c.jira.status());
}

export function useJiraSettings() {
  return useCoreQuery(["jira", "settings"], (c) => c.jira.settings());
}

export function useSaveJiraSettings() {
  return useCoreMutation((c, input: JiraSettings) => c.jira.setSettings(input));
}

export function useTestJira() {
  return useCoreMutation((c, input: JiraConnectionTest) => c.jira.test(input));
}

export function useJiraProjects(enabled: boolean) {
  return useCoreQuery(["jira", "projects"], (c) => c.jira.projects(), enabled);
}

export function useIssueTypes(projectKey: string | undefined) {
  return useCoreQuery(
    ["jira", "issue-types", projectKey],
    (c) => (projectKey ? c.jira.issueTypes(projectKey) : Promise.reject()),
    projectKey !== undefined,
  );
}

export function useJiraSearch(jql: string, enabled: boolean) {
  return useCoreQuery(
    ["jira", "search", jql],
    (c) => c.jira.search({ jql, maxResults: 50 }),
    enabled && jql.trim().length > 0,
  );
}

export function useJiraIssue(key: string) {
  return useCoreQuery(["jira", "issue", key], (c) => c.jira.issue(key));
}

export function useJiraComment(key: string) {
  return useCoreMutation((c, body: string) => c.jira.comment(key, body));
}

export function useJiraTransition(key: string) {
  return useCoreMutation((c, transitionId: string) => c.jira.transition(key, transitionId));
}

export function useCreateJiraIssue() {
  return useCoreMutation((c, input: CreateJiraIssueInput) => c.jira.create(input));
}
