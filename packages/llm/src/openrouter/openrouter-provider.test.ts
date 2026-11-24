import type { LlmEvent, LlmRequest } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { ModelCatalog } from "../catalog/catalog";
import { createOpenRouterProvider } from "./openrouter-provider";

const KEY = "sk-or-v1-secret-test-key";
const req: LlmRequest = {
  model: "anthropic/claude-sonnet-5.5",
  system: "Be brief",
  messages: [{ role: "user", content: "Hi" }],
  outputSchema: { type: "object" },
  tools: [{ name: "search", description: "Search", inputSchema: { type: "object" } }],
  reasoning: "low",
  maxTokens: 100,
};

type Call = { url: string; init: RequestInit };

/** A fetch stand-in that answers with an SSE body, delivered in awkward chunk sizes. */
function sseFetch(events: Array<string | object>, calls: Call[], chunkSize = 7) {
  const payload = events
    .map((e) => (typeof e === "string" ? e : `data: ${JSON.stringify(e)}\n\n`))
    .join("");
  const bytes = new TextEncoder().encode(payload);
  return async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize) {
          controller.enqueue(bytes.slice(i, i + chunkSize));
        }
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
}

function provider(fetchImpl: typeof fetch, key: string | null = KEY) {
  return createOpenRouterProvider({
    catalog: new ModelCatalog(),
    getApiKey: () => key ?? undefined,
    baseUrl: "http://stand-in.test/api/v1",
    fetch: fetchImpl,
  });
}

async function collect(stream: AsyncIterable<LlmEvent>) {
  const out: LlmEvent[] = [];
  for await (const e of stream) out.push(e);
  return out;
}

describe("OpenRouter provider", () => {
  it("sends an OpenAI-compatible body with the key and maps the stream", async () => {
    const calls: Call[] = [];
    const fetchImpl = sseFetch(
      [
        ": OPENROUTER PROCESSING\n\n",
        { choices: [{ delta: { reasoning: "Thinking" } }] },
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "call_a", function: { name: "search", arguments: '{"q":' } },
                ],
              },
            },
          ],
        },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        {
          choices: [],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            cost: 0.002,
            prompt_tokens_details: { cached_tokens: 40 },
            completion_tokens_details: { reasoning_tokens: 5 },
          },
        },
        "data: [DONE]\n\n",
      ],
      calls,
    );
    const events = await collect(provider(fetchImpl).stream(req));
    expect(events).toEqual([
      { type: "thinking", delta: "Thinking" },
      { type: "text", delta: "Hel" },
      { type: "text", delta: "lo" },
      { type: "tool_call", id: "call_a", name: "search", input: { q: "x" } },
      {
        type: "usage",
        usage: {
          inputTokens: 60,
          outputTokens: 20,
          cacheReadTokens: 40,
          reasoningTokens: 5,
          costUsd: 0.002,
        },
      },
      { type: "done", stopReason: "tool_calls" },
    ]);

    const [call] = calls;
    expect(call?.url).toBe("http://stand-in.test/api/v1/chat/completions");
    expect(new Headers(call?.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(call?.init.body))).toMatchObject({
      model: req.model,
      stream: true,
      max_tokens: 100,
      reasoning: { effort: "low" },
      messages: [
        { role: "system", content: "Be brief" },
        { role: "user", content: "Hi" },
      ],
      tools: [{ type: "function", function: { name: "search" } }],
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
  });

  it("flushes unfinished tool calls and keeps raw arguments it can't parse", async () => {
    const fetchImpl = sseFetch(
      [
        {
          choices: [
            { delta: { tool_calls: [{ index: 1, function: { name: "x", arguments: "{oops" } }] } },
          ],
        },
      ],
      [],
    );
    const events = await collect(provider(fetchImpl).stream(req));
    expect(events).toEqual([
      { type: "tool_call", id: "call_1", name: "x", input: { _raw: "{oops" } },
      { type: "done", stopReason: undefined },
    ]);
  });

  it("asks for a key without calling the API", async () => {
    const calls: Call[] = [];
    const events = await collect(provider(sseFetch([], calls), null).stream(req));
    expect(events[0]).toMatchObject({ type: "error", code: "openrouter.no_key" });
    expect(calls).toEqual([]);
    expect(await provider(sseFetch([], calls), null).detect()).toMatchObject({
      signedIn: false,
    });
  });

  it("maps HTTP errors and never echoes the key", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: `Invalid key ${KEY}` } }), { status: 401 });
    const events = await collect(provider(fetchImpl).stream(req));
    expect(events[0]).toMatchObject({ type: "error", code: "openrouter.http_401" });
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(events.at(-1)).toEqual({ type: "done", stopReason: "error" });
  });

  it("maps mid-stream errors, network failures, and cancellation", async () => {
    const midStream = sseFetch([{ choices: [], error: { message: "Overloaded", code: 529 } }], []);
    expect((await collect(provider(midStream).stream(req)))[0]).toEqual({
      type: "error",
      message: "Overloaded",
      code: "529",
    });

    const offline = async () => {
      throw new TypeError(`fetch failed for ${KEY}`);
    };
    const network = await collect(provider(offline).stream(req));
    expect(network[0]).toMatchObject({ type: "error", code: "openrouter.network" });
    expect(JSON.stringify(network)).not.toContain(KEY);

    const controller = new AbortController();
    controller.abort();
    const aborting = async (_url: string | URL | Request, init?: RequestInit) => {
      init?.signal?.throwIfAborted();
      return new Response("");
    };
    const cancelled = await collect(provider(aborting).stream(req, controller.signal));
    expect(cancelled).toEqual([
      { type: "error", code: "openrouter.cancelled", message: "Cancelled" },
      { type: "done", stopReason: "cancelled" },
    ]);
  });
});
