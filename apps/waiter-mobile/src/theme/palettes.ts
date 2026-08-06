export type AppColors = {
  bg: string;
  bgDeep: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
};

export type ThemeMode = "dark" | "light";

export const darkColors: AppColors = {
  bg: "#0B1220",
  bgDeep: "#070D18",
  card: "#111827",
  border: "#1E293B",
  text: "#F8FAFC",
  muted: "#94A3B8",
  accent: "#0F766E",
  accentSoft: "#14B8A6",
  accentText: "#F0FDFA",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

export const lightColors: AppColors = {
  bg: "#F4F7FB",
  bgDeep: "#FFFFFF",
  card: "#FFFFFF",
  border: "#D8E0EC",
  text: "#0F172A",
  muted: "#64748B",
  accent: "#0F766E",
  accentSoft: "#0D9488",
  accentText: "#F0FDFA",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
};

export const palettes: Record<ThemeMode, AppColors> = {
  dark: darkColors,
  light: lightColors,
};
