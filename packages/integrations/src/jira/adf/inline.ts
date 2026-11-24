import type { AdfMark, AdfNode } from "./schema";

type Rule = { re: RegExp; build(m: RegExpExecArray, marks: AdfMark[]): AdfNode[] };

const text = (value: string, marks: AdfMark[]): AdfNode =>
  marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value };

/** Earliest match wins; ties go to the first rule (code before emphasis). */
const rules: Rule[] = [
  {
    re: /`([^`]+)`/,
    build: (m, marks) => [
      text(m[1] ?? "", [...marks.filter((k) => k.type === "link"), { type: "code" }]),
    ],
  },
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
    build: (m, marks) =>
      parseInline(m[1] ?? "", [...marks, { type: "link", attrs: { href: m[2] } }]),
  },
  {
    re: /\*\*([^*]+)\*\*|__([^_]+)__/,
    build: (m, marks) => parseInline(m[1] ?? m[2] ?? "", [...marks, { type: "strong" }]),
  },
  {
    re: /~~([^~]+)~~/,
    build: (m, marks) => parseInline(m[1] ?? "", [...marks, { type: "strike" }]),
  },
  {
    re: /(?<![\w*])\*([^*\s][^*]*)\*(?!\w)|(?<![\w_])_([^_\s][^_]*)_(?!\w)/,
    build: (m, marks) => parseInline(m[1] ?? m[2] ?? "", [...marks, { type: "em" }]),
  },
  {
    re: /<?(https?:\/\/[^\s<>]+[^\s<>.,;:!?)])>?/,
    build: (m, marks) => [text(m[1] ?? "", [...marks, { type: "link", attrs: { href: m[1] } }])],
  },
];

/** Markdown inline syntax → ADF text nodes with marks. */
export function parseInline(source: string, marks: AdfMark[] = []): AdfNode[] {
  const out: AdfNode[] = [];
  let rest = source;
  while (rest) {
    let best: { rule: Rule; m: RegExpExecArray } | undefined;
    for (const rule of rules) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { rule, m };
    }
    if (!best) {
      out.push(text(rest, marks));
      break;
    }
    if (best.m.index > 0) out.push(text(rest.slice(0, best.m.index), marks));
    out.push(...best.rule.build(best.m, marks));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

/** Lines of a paragraph, joined by hard breaks (Jira keeps line breaks as typed). */
export function parseLines(lines: string[]): AdfNode[] {
  return lines.flatMap((line, i) => [
    ...(i > 0 ? [{ type: "hardBreak" }] : []),
    ...parseInline(line),
  ]);
}
