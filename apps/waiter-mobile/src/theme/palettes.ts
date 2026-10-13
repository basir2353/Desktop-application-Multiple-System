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
  bg: "#0A1218",
  bgDeep: "#061018",
  card: "#12202B",
  border: "#1F3340",
  text: "#F4FAF8",
  muted: "#8AA3B0",
  accent: "#0E7C72",
  accentSoft: "#2DD4BF",
  accentText: "#ECFDF8",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#F04343",
};

export const lightColors: AppColors = {
  bg: "#F3F7F6",
  bgDeep: "#FFFFFF",
  card: "#FFFFFF",
  border: "#D5E3DF",
  text: "#0F1F24",
  muted: "#5B7380",
  accent: "#0E7C72",
  accentSoft: "#0F766E",
  accentText: "#ECFDF8",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
};

export const palettes: Record<ThemeMode, AppColors> = {
  dark: darkColors,
  light: lightColors,
};
