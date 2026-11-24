import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { onEvent } from "../lib/bridge";
import { useUiStore } from "../stores/ui-store";

/** Runs the commands the native menu sends (its accelerators own the shortcuts). */
export function useMenuCommands(): void {
  const navigate = useNavigate();

  useEffect(
    () =>
      onEvent("menu.command", (command) => {
        switch (command) {
          case "command-palette":
            useUiStore.getState().togglePalette();
            return;
          case "new-chat":
            void navigate({ to: "/chats" });
            return;
          case "settings":
            void navigate({ to: "/settings" });
            return;
        }
      }),
    [navigate],
  );
}
