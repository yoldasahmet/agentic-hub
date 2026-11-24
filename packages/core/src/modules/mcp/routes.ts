import { mcpServerInputSchema } from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { McpService } from "./service";

const idParam = z.object({ serverId: z.uuidv7() });

/** `/mcp/servers`: CRUD, a connection test, and a server's tools. */
export const mcpRoutes = (mcp: McpService) =>
  new Hono<AppEnv>()
    .get("/servers", async (c) => c.json(await mcp.list(c.var.ctx)))
    .post("/servers", validate("json", mcpServerInputSchema), async (c) =>
      c.json(await mcp.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .put(
      "/servers/:serverId",
      validate("param", idParam),
      validate("json", mcpServerInputSchema),
      async (c) =>
        c.json(await mcp.update(c.var.ctx, c.req.valid("param").serverId, c.req.valid("json"))),
    )
    .delete("/servers/:serverId", validate("param", idParam), async (c) => {
      await mcp.remove(c.var.ctx, c.req.valid("param").serverId);
      return c.json({ ok: true });
    })
    .post("/servers/:serverId/test", validate("param", idParam), async (c) =>
      c.json(await mcp.test(c.var.ctx, c.req.valid("param").serverId)),
    )
    .get("/servers/:serverId/tools", validate("param", idParam), async (c) =>
      c.json(await mcp.tools(c.var.ctx, c.req.valid("param").serverId)),
    );
