import { create } from "zustand";

/** UI-only state. Server data lives in TanStack Query, never here. */
type UiState = {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  /** Chat id → its terminal-mode session, so it survives switching chats. */
  terminals: Record<string, string>;
  setTerminal: (chatId: string, terminalId: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  terminals: {},
  setTerminal: (chatId, terminalId) =>
    set((state) => {
      const terminals = { ...state.terminals };
      if (terminalId) terminals[chatId] = terminalId;
      else delete terminals[chatId];
      return { terminals };
    }),
}));
