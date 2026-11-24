import {
  type LlmStreamLine,
  llmCallInputSchema,
  llmCompareInputSchema,
  setModelEnabledInputSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import { failedCall, type LlmService } from "./service";

const detectQuerySchema = z.object({ refresh: z.enum(["0", "1"]).optional() });

/**
 * LLM providers and models. `/stream` answers with NDJSON: one
 * `LlmStreamLine` per line, events first, then the result. Closing the
 * request cancels the call (and stops the CLI's process group).
 */
export const llmRoutes = (llm: LlmService) =>
  new Hono<AppEnv>()
    .get("/providers", validate("query", detectQuerySchema), async (c) =>
      c.json(await llm.detect(c.req.valid("query").refresh === "1")),
    )
    .get("/models", async (c) => c.json(await llm.models(c.var.ctx)))
    .put("/models", validate("json", setModelEnabledInputSchema), async (c) =>
      c.json(await llm.setEnabled(c.var.ctx, c.req.valid("json"))),
    )
    .post("/models/sync", async (c) => c.json(await llm.syncOpenRouter(c.var.ctx)))
    .post("/call", validate("json", llmCallInputSchema), async (c) =>
      c.json(await llm.call(c.var.ctx, c.req.valid("json"), { signal: c.req.raw.signal })),
    )
    .post("/compare", validate("json", llmCompareInputSchema), async (c) =>
      c.json({ results: await llm.compare(c.var.ctx, c.req.valid("json"), c.req.raw.signal) }),
    )
    .post("/stream", validate("json", llmCallInputSchema), (c) => {
      const input = c.req.valid("json");
      const ctx = c.var.ctx;
      c.header("content-type", "application/x-ndjson");
      const write = (out: { write(s: string): unknown }, line: LlmStreamLine) =>
        out.write(`${JSON.stringify(line)}\n`);
      return stream(
        c,
        async (out) => {
          const abort = new AbortController();
          out.onAbort(() => abort.abort());
          const result = await llm.call(ctx, input, {
            signal: abort.signal,
            onEvent: (event) => void write(out, { kind: "event", event }),
          });
          await write(out, { kind: "result", result });
        },
        // Headers are already sent, so a late failure is reported as a failed result line.
        async (err, out) => {
          await write(out, { kind: "result", result: failedCall(input, err) });
        },
      );
    });
