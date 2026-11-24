import type { ChatTarget, EntityIdentity } from "@agentic/contracts";
import { APP_IDENTITY } from "@agentic/ui";
import { useAgents } from "../agents/queries";
import { useWorkflows } from "../workflows/queries";

export type TargetOption = {
  /** `app`, `agent:<id>`, or `workflow:<id>`: stable keys for lists and `@mentions`. */
  key: string;
  target: ChatTarget;
  identity: EntityIdentity;
  slug: string;
  description: string;
  /** Agents and workflows chat only through a published version. */
  published: boolean;
};

export const targetKey = (target: ChatTarget) =>
  target.kind === "app" ? "app" : `${target.kind}:${target.id}`;

const APP_OPTION: TargetOption = {
  key: "app",
  target: { kind: "app" },
  identity: APP_IDENTITY,
  slug: "app",
  description: "The general assistant: answers, finds, and runs agents and workflows",
  published: true,
};

/** Everything a chat can talk to: the App, then the workspace's agents and workflows. */
export function useChatTargets() {
  const agents = useAgents().data ?? [];
  const workflows = useWorkflows().data ?? [];
  const options: TargetOption[] = [
    APP_OPTION,
    ...agents.map((a) => ({
      key: `agent:${a.id}`,
      target: { kind: "agent" as const, id: a.id },
      identity: a,
      slug: a.slug,
      description: a.description,
      published: a.latestVersion !== null,
    })),
    ...workflows.map((w) => ({
      key: `workflow:${w.id}`,
      target: { kind: "workflow" as const, id: w.id },
      identity: w,
      slug: w.slug,
      description: w.description,
      published: w.latestVersion !== null,
    })),
  ];
  const find = (target: ChatTarget) => options.find((o) => o.key === targetKey(target));
  return { options, find };
}
