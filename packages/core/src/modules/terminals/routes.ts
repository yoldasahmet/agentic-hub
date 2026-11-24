import { openTerminalInputSchema, terminalIdParamSchema } from "@agentic/contracts";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { TerminalService } from "./service";

/** `/terminals`: open, list, and close terminal-mode sessions. Their I/O goes over the socket. */
export const terminalRoutes = (terminals: TerminalService) =>
  new Hono<AppEnv>()
    .get("/", (c) => c.json(terminals.list(c.var.ctx)))
    .post("/", validate("json", openTerminalInputSchema), async (c) =>
      c.json(await terminals.open(c.var.ctx, c.req.valid("json")), 201),
    )
    .delete("/:terminalId", validate("param", terminalIdParamSchema), (c) => {
      terminals.close(c.var.ctx, c.req.valid("param").terminalId);
      return c.json({ ok: true });
    });
