import { PLATFORM_EDITION } from "./edition";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "pops-theme";

export function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyEditionChrome(): void {
  const root = document.documentElement;
  root.dataset.edition = PLATFORM_EDITION;
  document.body.classList.toggle("edition-mobizone", PLATFORM_EDITION === "mobizone");
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  // Keep both selectors in sync — Tailwind darkMode uses class + [data-theme=dark].
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  document.body.classList.toggle("theme-light", mode === "light");
  document.body.classList.toggle("theme-dark", mode === "dark");
  applyEditionChrome();
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function initTheme(): ThemeMode {
  const mode = getStoredTheme();
  applyTheme(mode);
  return mode;
}
