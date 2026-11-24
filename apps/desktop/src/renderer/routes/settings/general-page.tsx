import { Button } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { useAppInfo } from "../../shell/queries";

export function GeneralSettingsPage() {
  const { data: info } = useAppInfo();
  const rows = [
    ["App", info?.name],
    ["Version", info?.version],
    ["Platform", info?.platform],
    ["Build", info ? (info.isPackaged ? "Release" : "Development") : undefined],
  ] as const;

  return (
    <section className="grid gap-4">
      <h2 className="font-serif text-xl">General</h2>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-card border border-border bg-surface p-4 shadow-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd data-selectable>{value ?? "…"}</dd>
          </div>
        ))}
      </dl>
      <div>
        <Button size="sm" asChild>
          <Link to="/welcome">Open first-run setup</Link>
        </Button>
      </div>
    </section>
  );
}
