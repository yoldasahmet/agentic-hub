import { AppError } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, asc, eq, inArray } from "drizzle-orm";

const { skills } = schema;
export type SkillRow = typeof skills.$inferSelect;
type Values = {
  name: string;
  slug: string;
  source: string;
  content: string | null;
  path: string | null;
};

/** Skills per workspace, unique by slug. */
export class SkillRepository {
  constructor(private readonly db: Database) {}

  list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(skills)
      .where(eq(skills.workspaceId, workspaceId))
      .orderBy(asc(skills.name));
  }

  bySlugs(workspaceId: string, slugs: readonly string[]): Promise<SkillRow[]> {
    if (slugs.length === 0) return Promise.resolve([]);
    return this.db
      .select()
      .from(skills)
      .where(and(eq(skills.workspaceId, workspaceId), inArray(skills.slug, [...slugs])));
  }

  async get(ctx: LocalContext, id: string): Promise<SkillRow> {
    const [row] = await this.db
      .select()
      .from(skills)
      .where(and(eq(skills.workspaceId, ctx.workspaceId), eq(skills.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Skill ${id} not found`);
    return row;
  }

  async insert(ctx: LocalContext, values: Values): Promise<SkillRow> {
    const [row] = await this.db
      .insert(skills)
      .values({ workspaceId: ctx.workspaceId, createdBy: ctx.userId, ...values })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new AppError("conflict", `A skill with the slug ${values.slug} already exists`);
    return row;
  }

  async update(ctx: LocalContext, id: string, values: Values): Promise<SkillRow> {
    const [row] = await this.db
      .update(skills)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(skills.workspaceId, ctx.workspaceId), eq(skills.id, id)))
      .returning();
    if (!row) throw new AppError("not_found", `Skill ${id} not found`);
    return row;
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.db
      .delete(skills)
      .where(and(eq(skills.workspaceId, ctx.workspaceId), eq(skills.id, id)));
  }
}
