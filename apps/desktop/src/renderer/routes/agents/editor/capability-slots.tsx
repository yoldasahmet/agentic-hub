import type { AgentCapabilities } from "@agentic/contracts";
import { Label, TagListInput } from "@agentic/ui";
import { useMcpServers, useSkills, useToolCatalog } from "../../settings/tools/queries";
import { ApprovalPolicyField } from "./approval-policy-field";

type SlotKey = "tools" | "mcpServers" | "skills";

const slots: Array<{ key: SlotKey; label: string; hint: string }> = [
  { key: "tools", label: "Tools", hint: "Tools the agent may call, e.g. git.diff or git.*" },
  { key: "mcpServers", label: "MCP servers", hint: "Every tool of these MCP servers." },
  { key: "skills", label: "Skills", hint: "Skills loaded into the agent's system prompt." },
];

/**
 * The tools, MCP servers, and skills the agent may use, by name (resolved
 * at run time, so a server's new tools apply), and when it must ask first.
 */
export function CapabilitySlots({
  value,
  onChange,
}: {
  value: AgentCapabilities;
  onChange: (value: AgentCapabilities) => void;
}) {
  const tools = useToolCatalog().data?.tools ?? [];
  const groups = [
    ...new Set(tools.filter((t) => t.source === "builtin").map((t) => t.name.split(".")[0])),
  ];
  const suggestions: Record<SlotKey, string[]> = {
    tools: [...tools.map((t) => t.name), ...groups.map((g) => `${g}.*`)],
    mcpServers: (useMcpServers().data ?? []).filter((s) => s.enabled).map((s) => s.name),
    skills: (useSkills().data ?? []).map((s) => s.slug),
  };
  return (
    <div className="grid gap-4">
      {slots.map((slot) => (
        <div key={slot.key} className="grid gap-1.5">
          <Label htmlFor={`slot-${slot.key}`}>{slot.label}</Label>
          <TagListInput
            id={`slot-${slot.key}`}
            placeholder={slot.hint}
            suggestions={suggestions[slot.key]}
            value={value[slot.key]}
            onChange={(names) => onChange({ ...value, [slot.key]: names })}
          />
        </div>
      ))}
      <ApprovalPolicyField
        value={value.approval}
        onChange={(approval) => onChange({ ...value, approval })}
      />
    </div>
  );
}
