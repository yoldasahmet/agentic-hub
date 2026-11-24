import { AppError, type GitStatus } from "@agentic/contracts";
import { buildChildEnv } from "../process/child-env";
import { runCommand } from "../process/run-command";
import { resolveCommand, searchPath } from "../process/search-path";
import { validateWorkingDir } from "../process/working-dir";

const MAX_CHANGES = 200;
const NOT_A_REPO: GitStatus = { repo: false, branch: null, ahead: 0, behind: 0, changes: [] };

/** `git status` of a working dir, parsed from the porcelain v2 format (context panel). */
export async function gitStatus(dir: string): Promise<GitStatus> {
  const cwd = await validateWorkingDir(dir);
  const path = await searchPath();
  const git = await resolveCommand("git", path);
  if (!git) throw new AppError("cli.not_found", "`git` was not found on PATH");
  const env = { ...buildChildEnv(process.env, { path }), GIT_OPTIONAL_LOCKS: "0" };
  const out = await runCommand(git, ["status", "--porcelain=v2", "--branch", "-z"], { env, cwd });
  if (out.code !== 0) return NOT_A_REPO;
  return parsePorcelain(out.stdout);
}

/** Parses `--porcelain=v2 --branch -z`: `# branch.*` headers, then one record per changed path. */
export function parsePorcelain(text: string): GitStatus {
  const status: GitStatus = { repo: true, branch: null, ahead: 0, behind: 0, changes: [] };
  const records = text.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i] ?? "";
    if (record.startsWith("# branch.head ")) {
      const head = record.slice("# branch.head ".length);
      status.branch = head === "(detached)" ? null : head;
    } else if (record.startsWith("# branch.ab ")) {
      const [ahead, behind] = record.slice("# branch.ab ".length).split(" ");
      status.ahead = Math.abs(Number(ahead) || 0);
      status.behind = Math.abs(Number(behind) || 0);
    } else if (record.startsWith("1 ") || record.startsWith("2 ") || record.startsWith("u ")) {
      const fields = record.split(" ");
      const kind = fields[0];
      const xy = fields[1] ?? "..";
      const pathIndex = kind === "1" ? 8 : kind === "2" ? 9 : 10;
      push(status, fields.slice(pathIndex).join(" "), xy.replace(/\./g, " ").trim());
      if (kind === "2") i++; // a rename's original path is the next record
    } else if (record.startsWith("? ")) {
      push(status, record.slice(2), "??");
    }
  }
  return status;
}

function push(status: GitStatus, path: string, code: string) {
  if (path && status.changes.length < MAX_CHANGES) status.changes.push({ path, status: code });
}
