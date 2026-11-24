import { z } from "zod";
import type { AppTool, ChatTargets } from "../deps";

const inputSchema = z.object({ query: z.string().max(200).default("") });

/** Finds agents and workflows by words in their name, slug, or description. */
export function findTool(targets: ChatTargets): AppTool {
  return {
    name: "find",
    description: "Search the workspace's agents and workflows.",
    parameters: '{ "query": "words to match" }',
    async run(raw, { workspaceId }) {
      const { query } = inputSchema.parse(raw);
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const catalog = await targets.catalog(workspaceId);
      return catalog
        .filter((entry) => {
          const haystack = `${entry.name} ${entry.slug} ${entry.description}`.toLowerCase();
          return words.every((word) => haystack.includes(word));
        })
        .slice(0, 20);
    },
  };
}
