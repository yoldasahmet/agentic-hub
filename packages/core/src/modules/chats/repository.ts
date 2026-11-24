import { AppError, type ChatTarget, type ModelRef } from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

const { chats } = schema;
export type ChatRow = typeof chats.$inferSelect;

export type ChatValues = {
  title: string;
  target: ChatTarget;
  model: ModelRef | null;
  workingDir: string | null;
};
export type ChatPatch = Partial<ChatValues> & { archived?: boolean };

/** Chats (the index of chat threads). Every query is scoped by workspace. */
export class ChatRepository {
  constructor(private readonly db: Database) {}

  list(ctx: LocalContext, archived: boolean): Promise<ChatRow[]> {
    return this.db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.workspaceId, ctx.workspaceId),
          archived ? isNotNull(chats.archivedAt) : isNull(chats.archivedAt),
        ),
      )
      .orderBy(desc(chats.updatedAt))
      .limit(500);
  }

  async get(ctx: LocalContext, id: string): Promise<ChatRow> {
    const [row] = await this.db
      .select()
      .from(chats)
      .where(and(eq(chats.workspaceId, ctx.workspaceId), eq(chats.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Chat ${id} not found`);
    return row;
  }

  async insert(ctx: LocalContext, values: ChatValues & { threadId: string }): Promise<ChatRow> {
    const [row] = await this.db
      .insert(chats)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        title: values.title,
        ...targetColumns(values.target),
        model: values.model,
        workingDir: values.workingDir,
        threadId: values.threadId,
      })
      .returning();
    if (!row) throw new Error("Failed to create the chat");
    return row;
  }

  async update(ctx: LocalContext, id: string, patch: ChatPatch): Promise<ChatRow> {
    const { target, archived, ...rest } = patch;
    const [row] = await this.db
      .update(chats)
      .set({
        ...rest,
        ...(target ? targetColumns(target) : {}),
        ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
        updatedAt: new Date(),
      })
      .where(and(eq(chats.workspaceId, ctx.workspaceId), eq(chats.id, id)))
      .returning();
    if (!row) throw new AppError("not_found", `Chat ${id} not found`);
    return row;
  }

  /** Moves a chat to the top of the list when it gets a message. */
  async touch(id: string): Promise<void> {
    await this.db.update(chats).set({ updatedAt: sql`now()` }).where(eq(chats.id, id));
  }

  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.db
      .delete(chats)
      .where(and(eq(chats.workspaceId, ctx.workspaceId), eq(chats.id, id)));
  }
}

function targetColumns(target: ChatTarget) {
  return { targetKind: target.kind, targetId: target.kind === "app" ? null : target.id };
}
