import {
  type ApprovalPolicy,
  approvalDecisionSchema,
  type ToolPermission,
  toolPermissions,
} from "@agentic/contracts";
import {
  PermissionBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";

const decisions = { allow: "Run", ask: "Ask first", deny: "Never" } as const;

/** Per permission level: run the tool, ask a person first (a gate), or refuse it. */
export function ApprovalPolicyField({
  value,
  onChange,
}: {
  value: ApprovalPolicy;
  onChange: (value: ApprovalPolicy) => void;
}) {
  const set = (level: ToolPermission, next: string) => {
    const decision = approvalDecisionSchema.safeParse(next);
    if (decision.success) onChange({ ...value, [level]: decision.data });
  };
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-1.5 font-medium text-fg">Approvals</legend>
      {toolPermissions.map((level) => (
        <div key={level} className="flex items-center gap-3">
          <span className="w-24">
            <PermissionBadge permission={level} />
          </span>
          <Select value={value[level]} onValueChange={(next) => set(level, next)}>
            <SelectTrigger aria-label={`${level} tools`} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(decisions).map(([decision, label]) => (
                <SelectItem key={decision} value={decision}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <p className="text-sm text-fg-muted">
        "Ask first" pauses the run with an approval card in the Inbox and the chat.
      </p>
    </fieldset>
  );
}
