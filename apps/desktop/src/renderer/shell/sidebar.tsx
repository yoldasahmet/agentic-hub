import { Badge, cn, KeyHint } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { type NavItem, navItems, settingsItem } from "./nav-items";
import { useInboxAttention } from "./use-inbox-attention";

function NavLink({
  item,
  shortcut,
  count,
}: {
  item: NavItem;
  shortcut?: string[];
  count?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        "group flex items-center gap-2.5 rounded-control px-2 py-1.5 font-medium text-fg-muted",
        "hover:bg-surface-sunken hover:text-fg",
        "data-[status=active]:bg-accent-tint data-[status=active]:text-accent-ink",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {count ? <Badge aria-label={`${count} waiting`}>{count}</Badge> : null}
      {shortcut && (
        <KeyHint keys={shortcut} className="opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const waiting = useInboxAttention();
  return (
    <nav aria-label="Main" className="flex w-52 shrink-0 flex-col gap-0.5 bg-sidebar px-2 pb-2">
      {navItems.map((item) => (
        <NavLink key={item.path} item={item} count={item.path === "/inbox" ? waiting : undefined} />
      ))}
      <div className="flex-1" />
      <NavLink item={settingsItem} shortcut={["⌘", ","]} />
    </nav>
  );
}
