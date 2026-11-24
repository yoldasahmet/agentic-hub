import type { LlmEvent, LlmRequest } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../provider";
import { callStructured } from "./call-structured";
import { extractJson } from "./extract-json";
import { checkJsonSchema } from "./json-schema";

const schema = {
  type: "object",
  properties: { plan: { type: "string" }, steps: { type: "integer", minimum: 1 } },
  required: ["plan"],
  additionalProperties: false,
};

/** Answers each call with the next text; records what it was asked. */
function scripted(answers: string[], native = false) {
  const requests: LlmRequest[] = [];
  const provider: LlmProvider = {
    id: "scripted",
    name: "Scripted",
    transport: "api",
    capabilities: {
      streaming: true,
      tools: false,
      structuredOutput: native ? "native" : "extract",
      reasoning: false,
      images: false,
      mcp: false,
    },
    detect: async () => {
      throw new Error("unused");
    },
    listModels: async () => [],
    async *stream(req): AsyncGenerator<LlmEvent> {
      requests.push(req);
      yield { type: "text", delta: answers[requests.length - 1] ?? "" };
      yield { type: "usage", usage: { inputTokens: 10, outputTokens: 1 } };
      yield { type: "done" };
    },
  };
  return { provider, requests };
}

const req = {
  model: "m",
  messages: [{ role: "user" as const, content: "Plan" }],
  outputSchema: schema,
};

describe("extractJson", () => {
  it("finds JSON in plain, fenced, and chatty answers", () => {
    expect(extractJson('{"a":1}')).toEqual({ value: { a: 1 } });
    expect(extractJson('Here:\n```json\n{"a":2}\n```')).toEqual({ value: { a: 2 } });
    expect(extractJson('Sure! {"a":"}{"} hope that helps')).toEqual({ value: { a: "}{" } });
    expect(extractJson("[1, [2]] trailing")).toEqual({ value: [1, [2]] });
    expect(extractJson("no json here")).toBeUndefined();
    expect(extractJson("{ broken ]")).toBeUndefined();
  });
});

describe("checkJsonSchema", () => {
  it("validates against JSON Schema and lists issues by path", () => {
    expect(checkJsonSchema(schema, { plan: "x", steps: 2 })).toEqual({
      ok: true,
      value: { plan: "x", steps: 2 },
    });
    const bad = checkJsonSchema(schema, { steps: 0, extra: true });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.issues.join("\n")).toMatch(/plan/);
  });
});

describe("callStructured", () => {
  it("puts the schema in the prompt for extracting providers and validates the answer", async () => {
    const { provider, requests } = scripted(['```json\n{"plan":"ok","steps":2}\n```']);
    const outcome = await callStructured(provider, req);
    expect(outcome).toMatchObject({ ok: true, structured: { plan: "ok", steps: 2 }, attempts: 1 });
    expect(requests[0]?.system).toContain("JSON Schema");
    expect(requests[0]?.outputSchema).toBeUndefined();
  });

  it("passes the schema natively when the provider supports it", async () => {
    const { provider, requests } = scripted(['{"plan":"ok"}'], true);
    await callStructured(provider, req);
    expect(requests[0]?.outputSchema).toEqual(schema);
    expect(requests[0]?.system).toBeUndefined();
  });

  it("falls back once when the native provider rejects a valid schema", async () => {
    const { provider } = scripted([], true);
    provider.stream = async function* (request) {
      if (request.outputSchema) {
        yield { type: "error", code: "llm.schema_rejected", message: "Optional field" };
      } else {
        expect(request.system).toContain("JSON Schema");
        yield { type: "text", delta: '{"plan":"ok"}' };
      }
    };
    expect(await callStructured(provider, req, { retries: 0 })).toMatchObject({
      ok: true,
      attempts: 2,
      structured: { plan: "ok" },
    });
  });

  it("sends the issues back for repair and sums usage", async () => {
    const { provider, requests } = scripted(['{"steps":0}', '{"plan":"fixed"}']);
    const outcome = await callStructured(provider, req, { retries: 1 });
    expect(outcome).toMatchObject({ ok: true, structured: { plan: "fixed" }, attempts: 2 });
    expect(outcome.usage).toMatchObject({ inputTokens: 20, outputTokens: 2 });
    expect(requests[1]?.messages.at(-1)?.content).toMatch(/did not match the schema/);
  });

  it("fails with llm.output_invalid when repairs run out", async () => {
    const { provider } = scripted(["nope", "still nope"]);
    const outcome = await callStructured(provider, req, { retries: 1 });
    expect(outcome).toMatchObject({
      ok: false,
      attempts: 2,
      error: { code: "llm.output_invalid" },
    });
  });
});
