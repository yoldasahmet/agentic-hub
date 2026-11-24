import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppError, type ResolvedSkill, type Skill } from "@agentic/contracts";

const MAX_SKILL_BYTES = 100_000;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/;

/**
 * A skill's text: the row's Markdown, or the folder's `SKILL.md` read now
 * so edits on disk apply to the next run. Frontmatter is dropped; the
 * name already says what the skill is.
 */
export async function resolveSkill(skill: Skill): Promise<ResolvedSkill> {
  const raw = skill.source === "inline" ? (skill.content ?? "") : await readSkillDir(skill);
  return { slug: skill.slug, name: skill.name, content: raw.replace(FRONTMATTER, "").trim() };
}

async function readSkillDir(skill: Skill): Promise<string> {
  const file = join(skill.path ?? "", "SKILL.md");
  try {
    const text = await readFile(file, "utf8");
    return text.length > MAX_SKILL_BYTES ? text.slice(0, MAX_SKILL_BYTES) : text;
  } catch {
    throw new AppError("skill.unreadable", `Skill ${skill.name}: ${file} could not be read`);
  }
}

/** The section appended to a system prompt (agents) or a CLI session's prompt. */
export function renderSkills(skills: readonly ResolvedSkill[]): string {
  if (skills.length === 0) return "";
  const parts = skills.map((s) => `## Skill: ${s.name}\n\n${s.content}`);
  return `# Skills\n\nFollow these skills when they apply.\n\n${parts.join("\n\n")}`;
}
