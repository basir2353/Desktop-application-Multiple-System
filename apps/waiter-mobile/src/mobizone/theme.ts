/**
 * MobiZone — Signal Teal retail system
 * Cool mist surfaces + deep ink chrome + teal accent (phone-counter / IMEI shop).
 * Avoids cream–gold and purple-indigo AI defaults.
 */
export const mz = {
  /** Page background — cool mist */
  bg: "#E9EEF3",
  /** Ink chrome (headers, active chrome) */
  navy: "#0C1524",
  navyDeep: "#070E18",
  ink: "#0C1524",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardSoft: "#F1F5F9",
  border: "#CDD6E1",
  text: "#0C1524",
  muted: "#5B6B7C",
  /** Soft panel fill (replaces old ivory) */
  ivory: "#F1F5F9",
  /** Primary accent — signal teal (legacy key `gold` kept for call sites) */
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
  /** Text on ink surfaces */
  onNavy: "#E9EEF3",
  /** Text on teal primary buttons */
  onGold: "#FFFFFF",
  onAccent: "#FFFFFF",
} as const;
