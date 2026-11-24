import type { ReactNode } from "react";

export type ComposerSuggestion = {
  id: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
  /** `/command <arg>`: the command waits for an argument after it is picked. */
  arg?: string;
};

export type SuggestionQuery =
  | { kind: "command"; query: string }
  | { kind: "mention"; query: string; start: number }
  | null;

/** What the caret is completing: a `/command` at the start, or an `@mention` anywhere. */
export function suggestionQuery(text: string, caret: number): SuggestionQuery {
  const before = text.slice(0, caret);
  const command = /^\/([\w-]*)$/.exec(before);
  if (command) return { kind: "command", query: command[1] ?? "" };
  const mention = /(^|\s)@([\w.-]*)$/.exec(before);
  if (mention) {
    return {
      kind: "mention",
      query: mention[2] ?? "",
      start: caret - (mention[2]?.length ?? 0) - 1,
    };
  }
  return null;
}

export function matchSuggestions(items: ComposerSuggestion[], query: string): ComposerSuggestion[] {
  const q = query.toLowerCase();
  return items
    .filter((s) => !q || s.id.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
    .slice(0, 8);
}

/** `/name arg` typed out in full and sent: which command, with what argument. */
export function parseCommand(
  text: string,
  commands: ComposerSuggestion[],
): { id: string; arg: string } | undefined {
  const match = /^\/([\w-]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match?.[1] || !commands.some((c) => c.id === match[1])) return undefined;
  return { id: match[1], arg: (match[2] ?? "").trim() };
}
