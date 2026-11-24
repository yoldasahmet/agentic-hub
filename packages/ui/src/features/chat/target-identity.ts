import type { ChatTargetRef, EntityIdentity } from "@agentic/contracts";
import { PRODUCT_NAME } from "@agentic/contracts";

/** The App's own look: Claude terracotta with sparkles, next to agents' and workflows' identities. */
export const APP_IDENTITY: EntityIdentity = {
  name: PRODUCT_NAME,
  color: "terracotta",
  icon: "sparkles",
};

/** How a message's target looks: its recorded identity, or a neutral one. */
export function targetIdentity(ref: ChatTargetRef | undefined): EntityIdentity {
  if (!ref || ref.kind === "app") return APP_IDENTITY;
  return {
    name: ref.name,
    color: ref.color ?? "slate",
    icon: ref.icon ?? (ref.kind === "workflow" ? "workflow" : "bot"),
  };
}
