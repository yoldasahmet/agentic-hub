import type { ToolPermission } from "@agentic/contracts";
import { Badge } from "../primitives/badge";

const tones = { read: "neutral", write: "warning", dangerous: "danger" } as const;

/** A tool's permission level: read (neutral), write (warning), dangerous (danger). */
export function PermissionBadge({ permission }: { permission: ToolPermission }) {
  return <Badge tone={tones[permission]}>{permission}</Badge>;
}
