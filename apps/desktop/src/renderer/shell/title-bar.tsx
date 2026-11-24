import { PRODUCT_NAME } from "@agentic/contracts";
import { cn, KeyHint } from "@agentic/ui";
import { useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useUiStore } from "../stores/ui-store";
import { navItems, settingsItem } from "./nav-items";
import { useAppInfo } from "./queries";

function useCurrentSection(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const item = [...navItems, settingsItem].find((nav) => pathname.startsWith(nav.path));
  return item?.label ?? PRODUCT_NAME;
}

/** The draggable top bar. On macOS it leaves room for the inset traffic lights. */
export function TitleBar() {
  const section = useCurrentSection();
  const isMac = useAppInfo().data?.platform === "darwin";
  const openPalette = () => useUiStore.getState().setPaletteOpen(true);

  return (
    <header
      className={cn(
        "app-drag flex h-10 shrink-0 items-center gap-3 border-b border-border bg-sidebar pr-3",
        isMac ? "pl-20" : "pl-3",
      )}
    >
      <span className="font-serif text-prose">{PRODUCT_NAME}</span>
      <span aria-hidden className="text-fg-subtle">
        /
      </span>
      <span className="text-fg-muted">{section}</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={openPalette}
        className="app-no-drag flex h-7 w-64 items-center gap-2 rounded-control border border-border bg-surface px-2 text-fg-subtle hover:border-border-input"
      >
        <Search aria-hidden className="size-3.5" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <KeyHint keys={["⌘", "K"]} />
      </button>
    </header>
  );
}
