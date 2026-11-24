import { skillInputSchema } from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { SkillService } from "./service";

const idParam = z.object({ skillId: z.uuidv7() });

/** `/skills`: CRUD and a preview of the resolved text. */
export const skillRoutes = (skills: SkillService) =>
  new Hono<AppEnv>()
    .get("/", async (c) => c.json(await skills.list(c.var.ctx)))
    .post("/", validate("json", skillInputSchema), async (c) =>
      c.json(await skills.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .put("/:skillId", validate("param", idParam), validate("json", skillInputSchema), async (c) =>
      c.json(await skills.update(c.var.ctx, c.req.valid("param").skillId, c.req.valid("json"))),
    )
    .delete("/:skillId", validate("param", idParam), async (c) => {
      await skills.remove(c.var.ctx, c.req.valid("param").skillId);
      return c.json({ ok: true });
    })
    .get("/:skillId/preview", validate("param", idParam), async (c) =>
      c.json(await skills.preview(c.var.ctx, c.req.valid("param").skillId)),
    );
