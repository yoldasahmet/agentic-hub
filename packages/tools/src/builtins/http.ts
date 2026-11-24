import { AppError } from "@agentic/contracts";
import { z } from "zod";
import { defineTool, type ToolContext } from "../tool";

const url = z.url({ protocol: /^https?$/ });
const headers = z.record(z.string(), z.string().max(8192)).default({});

async function send(init: RequestInit & { url: string }, ctx: ToolContext) {
  const res = await fetch(init.url, { ...init, signal: ctx.signal, redirect: "follow" });
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ctx.maxOutputBytes) {
      chunks.push(value.subarray(0, value.byteLength - (size - ctx.maxOutputBytes)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    body: Buffer.concat(chunks).toString("utf8"),
    truncated,
  };
}

export const httpGet = defineTool({
  name: "http.get",
  title: "HTTP GET",
  description: "Fetch a URL with GET and return the status and body text.",
  permission: "read",
  input: z.object({ url, headers }),
  run: ({ url, headers }, ctx) => send({ url, method: "GET", headers }, ctx),
});

/** Any method with a body: it can change remote state, so it is a `write` tool. */
export const httpRequest = defineTool({
  name: "http.request",
  title: "HTTP request",
  description: "Send an HTTP request (POST, PUT, PATCH, DELETE) with an optional body.",
  permission: "write",
  input: z.object({
    method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
    url,
    headers,
    body: z.string().max(1_000_000).optional(),
  }),
  async run({ method, url, headers, body }, ctx) {
    if (method === "DELETE" && body) {
      throw new AppError("validation_failed", "DELETE requests take no body here");
    }
    return send({ url, method, headers, body }, ctx);
  },
});
