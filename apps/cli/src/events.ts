import type { Interrupt, RunEvent, RunStatus } from "@agentic/contracts";
import { brief, dim, green, print, red, yellow } from "./output";

const statusColor: Partial<Record<RunStatus, (text: string) => string>> = {
  succeeded: green,
  failed: red,
  canceled: red,
  waiting: yellow,
};

/** What a gate asks for, from the interrupt's own value (gate, review, or tool approval). */
export function describeInterrupt(interrupt: Interrupt): string {
  const value = interrupt.value;
  if (typeof value === "object" && value !== null && "kind" in value) {
    const label =
      ("title" in value && value.title) || ("label" in value && value.label) || interrupt.node;
    return `${String(value.kind)} at ${interrupt.node}: ${brief(label, 80)} ${dim(`(id ${interrupt.id})`)}`;
  }
  return `${interrupt.node}: ${brief(value, 80)} ${dim(`(id ${interrupt.id})`)}`;
}

/**
 * Human-readable event lines. Streamed model text is written as it comes,
 * so the next non-text event first ends that line.
 */
export class EventPrinter {
  private midLine = false;

  constructor(private readonly json: boolean) {}

  print(event: RunEvent): void {
    if (this.json) {
      print(JSON.stringify(event));
      return;
    }
    if (event.type === "message.delta") {
      process.stdout.write(event.payload.content);
      this.midLine = !event.payload.content.endsWith("\n");
      return;
    }
    if (this.midLine) print();
    this.midLine = false;
    const at = dim(event.at.slice(11, 19));
    for (const line of this.lines(event)) print(`${at} ${line}`);
  }

  private lines(event: Exclude<RunEvent, { type: "message.delta" }>): string[] {
    switch (event.type) {
      case "run.status": {
        const { status, error } = event.payload;
        const paint = statusColor[status] ?? ((text: string) => text);
        return [`● ${paint(status)}${error ? ` ${red(error.message)}` : ""}`];
      }
      case "node.updated":
        return [`→ ${event.payload.node} ${dim(brief(event.payload.update))}`];
      case "custom":
        return [dim(`· ${brief(event.payload.data)}`)];
      case "run.interrupted":
        return event.payload.interrupts.map((i) => `${yellow("⏸")} ${describeInterrupt(i)}`);
      case "run.output":
        return [`${green("⇒")} ${brief(event.payload.output, 2000)}`];
    }
  }

  finish(): void {
    if (this.midLine) print();
    this.midLine = false;
  }
}
