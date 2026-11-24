import type { WorkflowNode } from "@agentic/contracts";
import { useId } from "react";
import { Label } from "../../../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import { Switch } from "../../../primitives/switch";

type Props = { node: WorkflowNode; incoming: number; onChange: (node: WorkflowNode) => void };

/** Reviews before and after, join behavior, and retries. */
export function NodeBehavior({ node, incoming, onChange }: Props) {
  const id = useId();
  const attempts = node.retry?.maxAttempts ?? 1;
  const toggle = (key: "enabled" | "reviewInput" | "reviewOutput", label: string) => (
    <div className="flex items-center justify-between">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Switch
        id={`${id}-${key}`}
        checked={node[key]}
        onCheckedChange={(checked) => onChange({ ...node, [key]: checked })}
      />
    </div>
  );
  return (
    <div className="grid gap-3">
      {toggle("enabled", "Enabled")}
      {node.kind !== "gate" && toggle("reviewInput", "Review input before running")}
      {node.kind !== "gate" && toggle("reviewOutput", "Review output after running")}
      {incoming > 1 && (
        <div className="grid gap-1.5">
          <Label>With several incoming edges</Label>
          <Select
            value={node.join}
            onValueChange={(v) => onChange({ ...node, join: v === "any" ? "any" : "all" })}
          >
            <SelectTrigger aria-label="Join">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wait for all branches</SelectItem>
              <SelectItem value="any">Run on each arrival</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {node.kind !== "gate" && (
        <div className="grid gap-1.5">
          <Label>Attempts when it fails</Label>
          <Select
            value={String(attempts)}
            onValueChange={(v) =>
              onChange({
                ...node,
                retry:
                  Number(v) > 1
                    ? { maxAttempts: Number(v), backoffMs: node.retry?.backoffMs ?? 2000 }
                    : undefined,
              })
            }
          >
            <SelectTrigger aria-label="Attempts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 ? "Once (no retry)" : `Up to ${n} times`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
