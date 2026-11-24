import {
  AppError,
  type ApprovalDecision,
  type ApprovalPolicy,
  type ToolDescriptor,
  type ToolPermission,
} from "@agentic/contracts";
import type { ToolDefinition } from "./tool";

/**
 * In-process tools by name: the built-ins, and later the GitHub and Jira
 * tools (P10.4, P11.4). MCP tools are not registered here; they are
 * discovered per workspace through the MCP pool.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(...defs: ToolDefinition[]): this {
    for (const def of defs) {
      if (this.tools.has(def.descriptor.name)) {
        throw new AppError("conflict", `Tool ${def.descriptor.name} is already registered`);
      }
      this.tools.set(def.descriptor.name, def);
    }
    return this;
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()].map((t) => t.descriptor);
  }

  find(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
}

/** What the agent's policy says for a permission level. */
export function decide(policy: ApprovalPolicy, permission: ToolPermission): ApprovalDecision {
  return policy[permission];
}
