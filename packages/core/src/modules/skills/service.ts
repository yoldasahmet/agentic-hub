import {
  AppError,
  type ResolvedSkill,
  type Skill,
  type SkillInput,
  skillInputSchema,
  skillSourceSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { resolveSkill } from "@agentic/tools";
import { slugify } from "../../lib/slug";
import type { SkillRepository, SkillRow } from "./repository";

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    source: skillSourceSchema.catch("inline").parse(row.source),
    content: row.content,
    path: row.path,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toValues(input: SkillInput) {
  const parsed = skillInputSchema.parse(input);
  const slug = parsed.slug ?? slugify(parsed.name, "skill");
  return parsed.source === "inline"
    ? { name: parsed.name, slug, source: "inline", content: parsed.content, path: null }
    : { name: parsed.name, slug, source: "directory", content: null, path: parsed.path };
}

/** Skills: CRUD, a preview of the text an agent gets, and lookup by slug for the toolbox. */
export class SkillService {
  constructor(private readonly repo: SkillRepository) {}

  async list(ctx: LocalContext): Promise<Skill[]> {
    return (await this.repo.list(ctx.workspaceId)).map(toSkill);
  }

  async create(ctx: LocalContext, input: SkillInput): Promise<Skill> {
    return toSkill(await this.repo.insert(ctx, toValues(input)));
  }

  async update(ctx: LocalContext, id: string, input: SkillInput): Promise<Skill> {
    const values = toValues(input);
    const clash = (await this.repo.bySlugs(ctx.workspaceId, [values.slug])).find(
      (r) => r.id !== id,
    );
    if (clash)
      throw new AppError("conflict", `A skill with the slug ${values.slug} already exists`);
    return toSkill(await this.repo.update(ctx, id, values));
  }

  remove(ctx: LocalContext, id: string): Promise<void> {
    return this.repo.remove(ctx, id);
  }

  async preview(ctx: LocalContext, id: string): Promise<ResolvedSkill> {
    return resolveSkill(toSkill(await this.repo.get(ctx, id)));
  }

  async bySlugs(workspaceId: string, slugs: readonly string[]): Promise<Skill[]> {
    return (await this.repo.bySlugs(workspaceId, slugs)).map(toSkill);
  }
}
