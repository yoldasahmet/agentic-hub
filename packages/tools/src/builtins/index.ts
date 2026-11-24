import type { ToolDefinition } from "../tool";
import { fsList, fsRead, fsWrite } from "./fs";
import { gitCommit, gitDiff, gitLog, gitStatusTool } from "./git";
import { httpGet, httpRequest } from "./http";
import { shellRun } from "./shell";

/** The tools every workspace has. Integrations add theirs to the same registry. */
export function builtinTools(): ToolDefinition[] {
  return [
    fsRead,
    fsList,
    fsWrite,
    gitStatusTool,
    gitDiff,
    gitLog,
    gitCommit,
    shellRun,
    httpGet,
    httpRequest,
  ];
}
