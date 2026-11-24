import { type AdfMark, type AdfNode, attr } from "./schema";

/** Wraps text in Markdown for each mark, innermost first; code wins over the rest. */
function applyMarks(text: string, marks: AdfMark[] = []): string {
  if (marks.some((m) => m.type === "code")) {
    const link = marks.find((m) => m.type === "link");
    const code = `\`${text}\``;
    return link ? `[${code}](${attr(link, "href")})` : code;
  }
  let out = text;
  for (const mark of marks) {
    if (mark.type === "strong") out = `**${out}**`;
    else if (mark.type === "em") out = `_${out}_`;
    else if (mark.type === "strike") out = `~~${out}~~`;
    else if (mark.type === "link") {
      const href = attr(mark, "href");
      out = out === href ? `<${href}>` : `[${out}](${href})`;
    }
  }
  return out;
}

function inline(nodes: AdfNode[] = []): string {
  return nodes.map(inlineNode).join("");
}

function inlineNode(node: AdfNode): string {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    case "hardBreak":
      return "\n";
    case "mention":
      return attr(node, "text") || `@${attr(node, "id")}`;
    case "emoji":
      return attr(node, "text") || attr(node, "shortName");
    case "inlineCard":
      return `<${attr(node, "url")}>`;
    case "status":
      return `[${attr(node, "text")}]`;
    case "date": {
      const ms = Number(attr(node, "timestamp"));
      return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
    }
    default:
      return node.text ?? inline(node.content);
  }
}

const indent = (text: string, by: string) =>
  text
    .split("\n")
    .map((line, i) => (i === 0 || line === "" ? line : by + line))
    .join("\n");

function list(node: AdfNode, ordered: boolean): string {
  const start = Number(attr(node, "order", "1")) || 1;
  return (node.content ?? [])
    .map((item, i) => {
      const bullet = ordered ? `${start + i}. ` : "- ";
      const checkbox =
        item.type === "taskItem" ? (attr(item, "state") === "DONE" ? "[x] " : "[ ] ") : "";
      const body = item.type === "taskItem" ? inline(item.content) : blocks(item.content, "\n");
      return bullet + checkbox + indent(body, " ".repeat(bullet.length));
    })
    .join("\n");
}

function table(node: AdfNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      blocks(cell.content, " ").replaceAll("|", "\\|").replaceAll("\n", " "),
    ),
  );
  const [head, ...rest] = rows;
  if (!head) return "";
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rest.map(line)].join("\n");
}

function block(node: AdfNode): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content);
    case "heading": {
      const level = Math.min(Math.max(Number(attr(node, "level", "1")) || 1, 1), 6);
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "bulletList":
    case "taskList":
      return list(node, false);
    case "orderedList":
      return list(node, true);
    case "codeBlock":
      return `\`\`\`${attr(node, "language")}\n${inline(node.content)}\n\`\`\``;
    case "blockquote":
    case "panel":
      return blocks(node.content)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "rule":
      return "---";
    case "table":
      return table(node);
    case "expand":
    case "nestedExpand":
      return [`**${attr(node, "title")}**`, blocks(node.content)].filter(Boolean).join("\n\n");
    case "mediaSingle":
    case "mediaGroup":
    case "media":
      return "_(attachment)_";
    case "blockCard":
    case "embedCard":
      return `<${attr(node, "url")}>`;
    default:
      return node.content ? blocks(node.content) : inlineNode(node);
  }
}

function blocks(nodes: AdfNode[] = [], separator = "\n\n"): string {
  return nodes
    .map(block)
    .filter((text) => text !== "")
    .join(separator);
}

/** ADF → Markdown, for descriptions and comments shown in the app and given to agents. */
export function adfToMarkdown(doc: AdfNode | null | undefined): string {
  if (!doc) return "";
  return (doc.type === "doc" ? blocks(doc.content) : block(doc)).trim();
}
