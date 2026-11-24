import { z } from "zod";

/**
 * Cursor pagination for every list endpoint. The cursor is opaque to clients;
 * servers encode the last row's sort key (usually its UUIDv7 id).
 */
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
export type Page<T> = { items: T[]; nextCursor: string | null };
