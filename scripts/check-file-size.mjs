// Fails when a tracked source file exceeds the 250-line limit in AGENTS.md.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_LINES = 250;
const SOURCE = /\.(ts|tsx|js|mjs|cjs|css)$/;
const EXEMPT = [/(^|\/)drizzle\//, /\.gen\.ts$/, /\.d\.ts$/];

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => SOURCE.test(f) && !EXEMPT.some((re) => re.test(f)));

const tooLong = files
  .map((file) => {
    try {
      return { file, lines: readFileSync(file, "utf8").split("\n").length };
    } catch {
      return { file, lines: 0 }; // deleted in the working tree
    }
  })
  .filter(({ lines }) => lines > MAX_LINES);

if (tooLong.length > 0) {
  for (const { file, lines } of tooLong)
    console.error(`${file}: ${lines} lines (max ${MAX_LINES})`);
  console.error("Split these files by behavior (AGENTS.md → Readability).");
  process.exit(1);
}
console.log(`File size check passed (${files.length} files ≤ ${MAX_LINES} lines).`);
