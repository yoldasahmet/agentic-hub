import { type WorkflowBundle, workflowBundleSchema } from "@agentic/contracts";
import githubIssueToPr from "../templates/github-issue-to-pr.json" with { type: "json" };
import issueTriage from "../templates/issue-triage.json" with { type: "json" };
import jiraIssueToPr from "../templates/jira-issue-to-pr.json" with { type: "json" };
import marketingCampaignDraft from "../templates/marketing-campaign-draft.json" with {
  type: "json",
};
import prReview from "../templates/pr-review.json" with { type: "json" };
import sdlcPipeline from "../templates/sdlc-pipeline.json" with { type: "json" };

/**
 * Workflow templates are data (`templates/*.json`, R14), in the bundle
 * format export and import use. Their agents are the built-ins, by slug.
 * Parsed once, so a bad edit fails at startup.
 */
export const workflowTemplates: WorkflowBundle[] = [
  sdlcPipeline,
  githubIssueToPr,
  jiraIssueToPr,
  prReview,
  issueTriage,
  marketingCampaignDraft,
].map((raw) => workflowBundleSchema.parse(raw));
