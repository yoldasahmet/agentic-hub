import { readFileSync } from "node:fs";
import type { LlmEvent } from "@agentic/contracts";
import type { StreamParser } from "../stream-parser";

/** Feeds a recorded stdout capture (`fixtures/<name>.jsonl`) through a parser, line by line. */
export function replay(parser: StreamParser, name: string): LlmEvent[] {
  const text = readFileSync(new URL(`./${name}.jsonl`, import.meta.url), "utf8");
  return text.split("\n").flatMap((line) => parser.push(line));
}
