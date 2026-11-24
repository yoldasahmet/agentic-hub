import { describe, expect, it } from "vitest";
import { createClaudeCodeParser } from "./claude-code";
import { replay } from "./fixtures/replay";

describe("Claude Code stream parser", () => {
  it("streams deltas once, keeps tool calls, and skips subagents", () => {
    expect(replay(createClaudeCodeParser(), "claude-code-tools")).toEqual([
      { type: "thinking", delta: "Need to list files." },
      { type: "text", delta: "Let me " },
      { type: "text", delta: "check." },
      { type: "tool_call", id: "toolu_1", name: "Bash", input: { command: "ls" } },
      { type: "tool_result", id: "toolu_1", output: "README.md\nsrc", isError: false },
      { type: "text", delta: "Two entries." },
      {
        type: "usage",
        usage: {
          inputTokens: 120,
          outputTokens: 40,
          cacheReadTokens: 1000,
          cacheWriteTokens: 50,
          costUsd: 0.0123,
        },
      },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  it("uses complete messages when no partials came, and hides the structured-output tool", () => {
    expect(replay(createClaudeCodeParser(), "claude-code-structured")).toEqual([
      { type: "text", delta: "Answering." },
      {
        type: "usage",
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: undefined,
        },
      },
      { type: "structured", value: { plan: "x" } },
      { type: "done", stopReason: undefined },
    ]);
  });

  it("reports a failed run as an error before done", () => {
    const events = replay(createClaudeCodeParser(), "claude-code-error");
    expect(events.slice(-2)).toEqual([
      { type: "error", message: "Invalid API key · Please run /login" },
      { type: "done", stopReason: undefined },
    ]);
  });

  it("never throws on noise or broken JSON", () => {
    const parser = createClaudeCodeParser();
    for (const line of ["", "plain text", "{broken", "[1,2]", '{"type":"unknown"}', "null"]) {
      expect(parser.push(line)).toEqual([]);
    }
  });
});
