import { create } from "zustand";
import { applyTheme, getStoredTheme, type ThemeMode } from "../lib/theme";

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getStoredTheme(),
  setMode: (mode) => {
    applyTheme(mode);
    set({ mode });
  },
  toggle: () => {
    const next: ThemeMode = get().mode === "dark" ? "light" : "dark";
    get().setMode(next);
  },
}));
