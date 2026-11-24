import { type AgentBundle, agentBundleSchema } from "@agentic/contracts";
import coder from "../builtins/coder.json" with { type: "json" };
import gitCommitter from "../builtins/git-committer.json" with { type: "json" };
import issueCoder from "../builtins/issue-coder.json" with { type: "json" };
import jiraPrLinker from "../builtins/jira-pr-linker.json" with { type: "json" };
import jiraTriager from "../builtins/jira-triager.json" with { type: "json" };
import marketingCopywriter from "../builtins/marketing-copywriter.json" with { type: "json" };
import marketingEditor from "../builtins/marketing-editor.json" with { type: "json" };
import marketingStrategist from "../builtins/marketing-strategist.json" with { type: "json" };
import planner from "../builtins/planner.json" with { type: "json" };
import prOpener from "../builtins/pr-opener.json" with { type: "json" };
import prSummarizer from "../builtins/pr-summarizer.json" with { type: "json" };
import reviewer from "../builtins/reviewer.json" with { type: "json" };
import sdlcCoder from "../builtins/sdlc-coder.json" with { type: "json" };
import sdlcDeployer from "../builtins/sdlc-deployer.json" with { type: "json" };
import sdlcDesigner from "../builtins/sdlc-designer.json" with { type: "json" };
import sdlcPlanner from "../builtins/sdlc-planner.json" with { type: "json" };
import sdlcReviewer from "../builtins/sdlc-reviewer.json" with { type: "json" };
import sdlcTester from "../builtins/sdlc-tester.json" with { type: "json" };
import tester from "../builtins/tester.json" with { type: "json" };

/**
 * Built-in agents are data (`builtins/*.json`, R14), in the same bundle
 * format as export/import. Parsed once, so a bad edit fails at startup.
 * The skills they name are built-ins too (`builtin-skills.ts`).
 */
export const builtinAgents: AgentBundle[] = [
  planner,
  coder,
  reviewer,
  tester,
  prSummarizer,
  jiraTriager,
  issueCoder,
  gitCommitter,
  prOpener,
  jiraPrLinker,
  sdlcPlanner,
  sdlcDesigner,
  sdlcCoder,
  sdlcReviewer,
  sdlcTester,
  sdlcDeployer,
  marketingStrategist,
  marketingCopywriter,
  marketingEditor,
].map((raw) => agentBundleSchema.parse(raw));
