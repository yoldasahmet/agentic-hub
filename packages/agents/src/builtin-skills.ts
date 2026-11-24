import { type BundledSkill, bundledSkillSchema } from "@agentic/contracts";
import codeReview from "../builtins/skills/code-review.json" with { type: "json" };
import codeStyle from "../builtins/skills/code-style.json" with { type: "json" };
import deployRunbook from "../builtins/skills/deploy-runbook.json" with { type: "json" };
import designSystem from "../builtins/skills/design-system.json" with { type: "json" };
import e2eTesting from "../builtins/skills/e2e-testing.json" with { type: "json" };
import specWriting from "../builtins/skills/spec-writing.json" with { type: "json" };
import testRunner from "../builtins/skills/test-runner.json" with { type: "json" };

/**
 * Skills the built-in agents name, as data. Installing an agent adds the
 * ones the workspace lacks; a skill a person already has keeps its text.
 */
export const builtinSkills: BundledSkill[] = [
  specWriting,
  designSystem,
  codeStyle,
  codeReview,
  testRunner,
  e2eTesting,
  deployRunbook,
].map((raw) => bundledSkillSchema.parse(raw));
