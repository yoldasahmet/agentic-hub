import { appendFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { z } from "zod";
import { resolveInside } from "../guardrails/allowlist";
import { defineTool } from "../tool";

const MAX_ENTRIES = 500;

export const fsRead = defineTool({
  name: "fs.read",
  title: "Read file",
  description: "Read a text file in the working dir. Long files can be read in line ranges.",
  permission: "read",
  input: z.object({
    path: z.string().min(1).describe("Relative to the working dir"),
    fromLine: z.number().int().min(1).optional(),
    lines: z.number().int().min(1).max(5000).optional(),
  }),
  async run({ path, fromLine = 1, lines }, ctx) {
    const file = await resolveInside(ctx.cwd, path);
    const all = (await readFile(file, { encoding: "utf8", signal: ctx.signal })).split("\n");
    const end = lines ? fromLine - 1 + lines : all.length;
    return { path, totalLines: all.length, content: all.slice(fromLine - 1, end).join("\n") };
  },
});

export const fsList = defineTool({
  name: "fs.list",
  title: "List files",
  description: "List files and folders under a path in the working dir (dot folders skipped).",
  permission: "read",
  input: z.object({
    path: z.string().default("."),
    depth: z.number().int().min(1).max(5).default(2),
  }),
  async run({ path, depth }, ctx) {
    const root = await resolveInside(ctx.cwd, path);
    const entries: string[] = [];
    const walk = async (dir: string, level: number) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entries.length >= MAX_ENTRIES || ctx.signal.aborted) return;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        entries.push(`${relative(root, full)}${entry.isDirectory() ? "/" : ""}`);
        if (entry.isDirectory() && level < depth) await walk(full, level + 1);
      }
    };
    await walk(root, 1);
    return { path, entries, truncated: entries.length >= MAX_ENTRIES };
  },
});

export const fsWrite = defineTool({
  name: "fs.write",
  title: "Write file",
  description: "Create or overwrite a text file in the working dir, or append to it.",
  permission: "write",
  input: z.object({
    path: z.string().min(1),
    content: z.string().max(2_000_000),
    append: z.boolean().default(false),
  }),
  async run({ path, content, append }, ctx) {
    const file = await resolveInside(ctx.cwd, path);
    await mkdir(dirname(file), { recursive: true });
    if (append) await appendFile(file, content, "utf8");
    else await writeFile(file, content, { encoding: "utf8", signal: ctx.signal });
    return { path, bytes: (await stat(file)).size };
  },
});
