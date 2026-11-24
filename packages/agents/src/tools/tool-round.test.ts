import { toolDescriptorSchema } from "@agentic/contracts";
import { fakeProvider } from "@agentic/testing";
import { describe, expect, it, vi } from "vitest";
import { agentEventWriter } from "../stream-writer";
import { callWithTools } from "./tool-loop";
import { readToolDecision } from "./tool-round";

describe("structured tool selections", () => {
  it("distinguishes an action from the final answer", () => {
    expect(readToolDecision({ action: "fs.read", payload: '{"path":"README.md"}' })).toMatchObject({
      kind: "call",
      call: { tool: "fs.read", input: { path: "README.md" } },
    });
    expect(readToolDecision({ action: "answer", payload: "All tests passed." })).toEqual({
      kind: "answer",
      text: "All tests passed.",
    });
  });
  it("executes the selected tool once and returns plain text for a text-only agent", async () => {
    const tool = toolDescriptorSchema.parse({
      name: "fs.read",
      title: "Read",
      description: "",
      permission: "read",
      inputSchema: {},
      source: "builtin",
    });
    const provider = fakeProvider([
      '{"action":"fs.read","payload":"{}"}',
      '{"action":"answer","payload":"Read the file."}',
    ]);
    provider.capabilities.structuredOutput = "native";
    const invoke = vi.fn(async () => "sample");
    const result = await callWithTools(
      provider,
      { model: "sample", messages: [{ role: "user", content: "Read the file" }] },
      { retries: 0 },
      {
        toolset: { tools: [tool], invoke, skills: [], servers: [], mask: (value) => value },
        fenced: [tool],
        cwd: "/tmp",
        events: agentEventWriter(undefined),
      },
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(provider.requests[1]?.messages.at(-1)?.content).toContain("sample");
    expect(result).toMatchObject({ ok: true, text: "Read the file.", attempts: 2 });
    expect(result.structured).toBeUndefined();
  });

  it("asks for repair when a tool input is malformed", () => {
    for (const payload of ["", "[]", "null"]) {
      expect(readToolDecision({ action: "fs.read", payload }).kind).toBe("invalid");
    }
  });
});
