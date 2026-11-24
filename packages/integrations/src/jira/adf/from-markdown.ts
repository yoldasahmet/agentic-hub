import { parseInline, parseLines } from "./inline";
import type { AdfDoc, AdfNode } from "./schema";

const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

const isBlockStart = (line: string) =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);

/** A list: items at the first item's indent; deeper lines belong to the item before them. */
function parseList(lines: string[], start: number): { node: AdfNode; next: number } {
  const first = ITEM.exec(lines[start] ?? "");
  const base = first?.[1]?.length ?? 0;
  const ordered = /\d/.test(first?.[2] ?? "");
  const items: AdfNode[] = [];
  let i = start;
  while (i < lines.length) {
    const m = ITEM.exec(lines[i] ?? "");
    if (!m || (m[1] ?? "").length !== base || /\d/.test(m[2] ?? "") !== ordered) break;
    const body = [m[3] ?? ""];
    i++;
    while (i < lines.length) {
      const line = lines[i] ?? "";
      const depth = line.length - line.trimStart().length;
      if (line.trim() === "" || depth <= base) break;
      body.push(line.slice(Math.min(depth, base + 2)));
      i++;
    }
    items.push({ type: "listItem", content: parseBlocks(body) });
  }
  const order = Number.parseInt(first?.[2] ?? "1", 10);
  const node: AdfNode = ordered
    ? { type: "orderedList", attrs: { order: Number.isFinite(order) ? order : 1 }, content: items }
    : { type: "bulletList", content: items };
  return { node, next: i };
}

function parseBlocks(lines: string[]): AdfNode[] {
  const out: AdfNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith(fence[1] ?? "```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      i++;
      const content = code.length ? [{ type: "text", text: code.join("\n") }] : [];
      out.push({ type: "codeBlock", attrs: fence[2] ? { language: fence[2] } : {}, content });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      out.push({ type: "heading", attrs: { level }, content: parseInline(heading[2] ?? "") });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push({ type: "rule" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? "")) {
        quoted.push(QUOTE.exec(lines[i] ?? "")?.[1] ?? "");
        i++;
      }
      out.push({ type: "blockquote", content: parseBlocks(quoted) });
      continue;
    }
    if (ITEM.test(line)) {
      const { node, next } = parseList(lines, i);
      out.push(node);
      i = next;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      (para.length === 0 || !isBlockStart(lines[i] ?? ""))
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    out.push({ type: "paragraph", content: parseLines(para) });
  }
  return out;
}

/** Markdown → an ADF document, for comments, descriptions, and sub-tasks the app writes. */
export function markdownToAdf(markdown: string): AdfDoc {
  return {
    version: 1,
    type: "doc",
    content: parseBlocks(markdown.replaceAll("\r\n", "\n").split("\n")),
  };
}
