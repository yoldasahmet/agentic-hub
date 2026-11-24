import { describe, expect, it } from "vitest";
import { createCodexParser } from "./codex";
import { replay } from "./fixtures/replay";
import { createGeminiParser } from "./gemini";
import { createOpenCodeParser } from "./opencode";

describe("Codex stream parser", () => {
  it("identifies the native format rejection that can use validated extraction", () => {
    const message = JSON.stringify({ error: { code: "invalid_json_schema" } });
    const events = createCodexParser().push(
      JSON.stringify({ type: "turn.failed", error: { message } }),
    );
    expect(events).toEqual([{ type: "error", code: "llm.schema_rejected", message }]);
  });

  it("maps items to text, thinking, and tool calls emitted once", () => {
    expect(replay(createCodexParser(), "codex")).toEqual([
      { type: "thinking", delta: "**Planning** the change" },
      { type: "tool_call", id: "item_1", name: "shell", input: { command: "bash -lc ls" } },
      { type: "tool_result", id: "item_1", output: "README.md\n", isError: false },
      { type: "tool_call", id: "item_2", name: "shell", input: { command: "false" } },
      { type: "tool_result", id: "item_2", output: "", isError: true },
      {
        type: "tool_call",
        id: "item_3",
        name: "apply_patch",
        input: { changes: [{ path: "a.ts", kind: "update" }] },
      },
      { type: "tool_result", id: "item_3", output: "completed", isError: false },
      { type: "tool_call", id: "item_4", name: "github.get_issue", input: { n: 1 } },
      { type: "tool_result", id: "item_4", output: "not found", isError: true },
      { type: "text", delta: "Done." },
      { type: "usage", usage: { inputTokens: 500, cacheReadTokens: 1000, outputTokens: 80 } },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  it("reports stream errors and failed turns", () => {
    expect(replay(createCodexParser(), "codex-failed")).toEqual([
      { type: "error", message: "stream disconnected before completion" },
      { type: "error", message: "You've hit your usage limit." },
    ]);
  });
});

describe("Gemini stream parser", () => {
  it("streams assistant deltas, tools, and stats; warnings are not errors", () => {
    expect(replay(createGeminiParser(), "gemini")).toEqual([
      { type: "tool_call", id: "t1", name: "list_directory", input: { path: "." } },
      { type: "tool_result", id: "t1", output: "README.md", isError: false },
      { type: "tool_call", id: "t2", name: "read_file", input: {} },
      { type: "tool_result", id: "t2", output: "ENOENT", isError: true },
      { type: "text", delta: "There is " },
      { type: "text", delta: "one file." },
      { type: "usage", usage: { inputTokens: 150, cacheReadTokens: 100, outputTokens: 50 } },
      { type: "done", stopReason: "success" },
    ]);
  });

  it("reports errors and a failed result", () => {
    expect(replay(createGeminiParser(), "gemini-error")).toEqual([
      { type: "error", message: "Quota exceeded" },
      { type: "error", message: "Request failed" },
      { type: "done", stopReason: "error" },
    ]);
  });
});

describe("OpenCode stream parser", () => {
  it("sums usage across steps and ends on the final step", () => {
    expect(replay(createOpenCodeParser(), "opencode")).toEqual([
      { type: "thinking", delta: "Look around first." },
      { type: "tool_call", id: "c1", name: "bash", input: { command: "ls" } },
      { type: "tool_result", id: "c1", output: "README.md", isError: false },
      { type: "tool_call", id: "c2", name: "read", input: { path: "x" } },
      { type: "tool_result", id: "c2", output: "missing", isError: true },
      { type: "tool_call", id: "c3", name: "edit", input: {} },
      {
        type: "usage",
        usage: {
          inputTokens: 100,
          outputTokens: 10,
          reasoningTokens: 5,
          cacheReadTokens: 50,
          cacheWriteTokens: 0,
          costUsd: 0.001,
        },
      },
      { type: "text", delta: "All good." },
      {
        type: "usage",
        usage: {
          inputTokens: 300,
          outputTokens: 30,
          reasoningTokens: 5,
          cacheReadTokens: 50,
          cacheWriteTokens: 10,
          costUsd: 0.003,
        },
      },
      { type: "done", stopReason: "stop" },
    ]);
  });

  it("reports provider errors by message or name", () => {
    expect(replay(createOpenCodeParser(), "opencode-error")).toEqual([
      { type: "error", message: "No API key for anthropic" },
      { type: "error", message: "UnknownError" },
    ]);
  });
});
