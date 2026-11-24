import { type RunEvent, runEventSchema } from "@agentic/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventStream } from "./event-stream";
import { foldEvents } from "./fold-events";

let seq = 0;
const at = "2026-10-01T10:00:00.000Z";
const runId = "0199a3b0-0000-7000-8000-000000000000";
const ev = (event: Pick<RunEvent, "type" | "payload">): RunEvent => {
  seq += 1;
  const id = `0199a3b0-0000-7000-8000-${String(seq).padStart(12, "0")}`;
  return runEventSchema.parse({ ...event, id, runId, seq, at });
};
const llm = (event: unknown) => ev({ type: "custom", payload: { data: { kind: "llm", event } } });

const events: RunEvent[] = [
  ev({ type: "run.status", payload: { status: "running" } }),
  ev({
    type: "custom",
    payload: {
      data: { kind: "attempt", model: { providerId: "claude-code", model: "sonnet" }, attempt: 1 },
    },
  }),
  llm({ type: "thinking", delta: "Let me " }),
  llm({ type: "thinking", delta: "think." }),
  llm({ type: "text", delta: "Hello " }),
  llm({ type: "text", delta: "world" }),
  llm({ type: "tool_call", id: "t1", name: "git.status", input: { short: true } }),
  llm({ type: "tool_result", id: "t1", output: "clean", isError: false }),
  llm({ type: "usage", usage: { inputTokens: 1, outputTokens: 1 } }),
  llm({ type: "error", message: "Rate limited" }),
  ev({ type: "node.updated", payload: { node: "plan", update: {} } }),
  ev({ type: "run.interrupted", payload: { interrupts: [] } }),
  ev({ type: "custom", payload: { data: { progress: "50%" } } }),
];

describe("foldEvents", () => {
  it("merges deltas, joins tool results to calls, and leaves usage out", () => {
    expect(foldEvents(events).map((i) => i.kind)).toEqual([
      "status",
      "attempt",
      "thinking",
      "text",
      "tool",
      "error",
      "node",
      "gate",
      "custom",
    ]);
    const items = foldEvents(events);
    expect(items[3]).toEqual({ kind: "text", text: "Hello world" });
    expect(items[4]).toMatchObject({ name: "git.status", output: "clean", isError: false });
  });
});

describe("EventStream", () => {
  it("shows a placeholder before any event", () => {
    render(<EventStream events={[]} />);
    expect(screen.getByText("Waiting for events…")).toBeTruthy();
  });

  it("renders each kind of row, with provider display names", () => {
    render(<EventStream events={events} providerNames={{ "claude-code": "Claude Code" }} />);
    expect(screen.getByText(/Calling\s+Claude Code · sonnet/)).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByText("git.status")).toBeTruthy();
    expect(screen.getByText("Rate limited")).toBeTruthy();
    expect(screen.getByText("plan finished")).toBeTruthy();
    expect(screen.getByText("Waiting for your answer")).toBeTruthy();
    expect(screen.getByRole("list").getAttribute("aria-live")).toBe("polite");
  });

  it("grows text in place as deltas stream in", () => {
    const first = events.slice(0, 5);
    const { rerender } = render(<EventStream events={first} />);
    expect(screen.getByText("Hello")).toBeTruthy();
    rerender(<EventStream events={events.slice(0, 6)} />);
    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
