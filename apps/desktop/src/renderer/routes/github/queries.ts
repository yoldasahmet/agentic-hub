import type { RepoRef } from "@agentic/client";
import type { CreatePullInput, CreateReviewInput, GithubSettings } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export type ItemState = "open" | "closed" | "all";

export function useGithubStatus() {
  return useCoreQuery(["github", "status"], (c) => c.github.status());
}

export function useGithubSettings() {
  return useCoreQuery(["github", "settings"], (c) => c.github.settings());
}

export function useSaveGithubSettings() {
  return useCoreMutation((c, input: GithubSettings) => c.github.setSettings(input));
}

export function useRepos(enabled: boolean) {
  return useCoreQuery(["github", "repos"], (c) => c.github.repos(), enabled);
}

export function useRepoInfo(ref: RepoRef | undefined) {
  return useCoreQuery(
    ["github", "repo", ref],
    (c) => (ref ? c.github.repo(ref) : Promise.reject()),
    ref !== undefined,
  );
}

export function useIssues(ref: RepoRef | undefined, state: ItemState) {
  return useCoreQuery(
    ["github", "issues", ref, state],
    (c) => (ref ? c.github.issues(ref, { state }) : Promise.reject()),
    ref !== undefined,
  );
}

export function usePulls(ref: RepoRef | undefined, state: ItemState) {
  return useCoreQuery(
    ["github", "pulls", ref, state],
    (c) => (ref ? c.github.pulls(ref, { state }) : Promise.reject()),
    ref !== undefined,
  );
}

export function useIssue(ref: RepoRef, number: number) {
  return useCoreQuery(["github", "issue", ref, number], (c) => c.github.issue(ref, number));
}

export function usePull(ref: RepoRef, number: number) {
  return useCoreQuery(["github", "pull", ref, number], (c) => c.github.pull(ref, number));
}

export function usePullFiles(ref: RepoRef, number: number) {
  return useCoreQuery(["github", "files", ref, number], (c) => c.github.pullFiles(ref, number));
}

export function useAddComment(ref: RepoRef, number: number) {
  return useCoreMutation((c, body: string) => c.github.comment(ref, number, body));
}

export function useCreatePull(ref: RepoRef) {
  return useCoreMutation((c, input: CreatePullInput) => c.github.createPull(ref, input));
}

export function useSubmitReview(ref: RepoRef, number: number) {
  return useCoreMutation((c, input: CreateReviewInput) => c.github.review(ref, number, input));
}

export function useStartDeviceFlow() {
  return useCoreMutation((c, _: undefined) => c.github.device.start());
}

export function useDeviceFlowState(flowId: string | undefined) {
  return useCoreQuery(
    ["github", "device", flowId],
    (c) => (flowId ? c.github.device.state(flowId) : Promise.reject()),
    flowId !== undefined,
  );
}
