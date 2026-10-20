import { useWindowDimensions } from "react-native";
import { colorsForMode, useThemeStore } from "../stores/themeStore";

export type MzColors = {
  bg: string;
  navy: string;
  navyDeep: string;
  ink: string;
  surface: string;
  card: string;
  cardSoft: string;
  border: string;
  text: string;
  muted: string;
  ivory: string;
  gold: string;
  goldDim: string;
  goldBright: string;
  accent: string;
  teal: string;
  tealDim: string;
  rose: string;
  blue: string;
  orange: string;
  green: string;
  white: string;
  purple: string;
  inputBg: string;
  inputText: string;
  inputBorder: string;
  onNavy: string;
  onGold: string;
  onAccent: string;
  placeholder: string;
  dangerSoft: string;
  dangerBorder: string;
  mode: "light" | "dark";
};

const light: Omit<MzColors, "mode"> = {
  bg: "#EEF2F6",
  navy: "#0C1524",
  navyDeep: "#070E18",
  ink: "#0C1524",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardSoft: "#F1F5F9",
  border: "#D0D9E4",
  text: "#0C1524",
  muted: "#5B6B7C",
  ivory: "#F1F5F9",
  gold: "#0F9B8E",
  goldDim: "#0B7A70",
  goldBright: "#14B8A6",
  accent: "#0F9B8E",
  teal: "#0F9B8E",
  tealDim: "#14B8A6",
  rose: "#E11D48",
  blue: "#0284C7",
  orange: "#EA580C",
  green: "#15803D",
  white: "#FFFFFF",
  purple: "#0F9B8E",
  inputBg: "#FFFFFF",
  inputText: "#0C1524",
  inputBorder: "#B8C4D1",
  onNavy: "#E9EEF3",
  onGold: "#FFFFFF",
  onAccent: "#FFFFFF",
  placeholder: "#8A9AAB",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
};

const dark: Omit<MzColors, "mode"> = {
  bg: "#0A1218",
  navy: "#0E1A28",
  navyDeep: "#061018",
  ink: "#E8EEF4",
  surface: "#12202B",
  card: "#12202B",
  cardSoft: "#1A2B38",
  border: "#243847",
  text: "#F4FAF8",
  muted: "#8AA3B0",
  ivory: "#1A2B38",
  gold: "#14B8A6",
  goldDim: "#0F9B8E",
  goldBright: "#2DD4BF",
  accent: "#14B8A6",
  teal: "#14B8A6",
  tealDim: "#2DD4BF",
  rose: "#FB7185",
  blue: "#38BDF8",
  orange: "#FB923C",
  green: "#34D399",
  white: "#FFFFFF",
  purple: "#14B8A6",
  inputBg: "#0E1A24",
  inputText: "#F4FAF8",
  inputBorder: "#2A3F4F",
  onNavy: "#E9EEF3",
  onGold: "#FFFFFF",
  onAccent: "#FFFFFF",
  placeholder: "#6B8494",
  dangerSoft: "#3F1A22",
  dangerBorder: "#7F1D2D",
};

/** Static light palette — prefer `useMz()` so UI re-renders on theme change. */
export const mz: MzColors = { ...light, mode: "light" };

export function mzForMode(mode: "light" | "dark"): MzColors {
  return mode === "dark" ? { ...dark, mode } : { ...light, mode };
}

/** Subscribe to app theme (light / dark). */
export function useMz(): MzColors {
  const mode = useThemeStore((s) => s.mode);
  return mzForMode(mode);
}

/** Compact screen padding + gap; wider on tablets. */
export function useMzLayout() {
  const { width } = useWindowDimensions();
  const pad = width >= 720 ? 20 : 12;
  const gap = width >= 720 ? 12 : 8;
  const cols = width >= 720 ? 3 : 2;
  const tileW = `${(100 / cols - 1.2).toFixed(2)}%` as `${number}%`;
  return { width, pad, gap, cols, tileW, isWide: width >= 720 };
}

/** Keep waiter theme accents aligned with Mobizone teal when toggled. */
export function syncMzAccentHint(): void {
  void colorsForMode;
}
