import { create } from "zustand";
import { secureDelete, secureGet, secureSet } from "../lib/secureStorage";
import { palettes, type AppColors, type ThemeMode } from "../theme/palettes";

const THEME_KEY = "pops-waiter-theme-mode";

type ThemeState = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  hydrate: () => Promise<void>;
};

export function colorsForMode(mode: ThemeMode): AppColors {
  return palettes[mode];
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  hydrated: false,

  setMode: (mode) => {
    void secureSet(THEME_KEY, mode);
    set({ mode });
  },

  toggle: () => {
    const next: ThemeMode = get().mode === "dark" ? "light" : "dark";
    get().setMode(next);
  },

  hydrate: async () => {
    try {
      const stored = await secureGet(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        set({ mode: stored, hydrated: true });
        return;
      }
    } catch {
      // keep default
    }
    set({ hydrated: true });
  },
}));

export function getThemeMode(): ThemeMode {
  return useThemeStore.getState().mode;
}

export function getColors(): AppColors {
  return colorsForMode(getThemeMode());
}

/** Clear persisted theme (tests / sign-out optional). */
export async function clearThemePreference(): Promise<void> {
  await secureDelete(THEME_KEY);
}
