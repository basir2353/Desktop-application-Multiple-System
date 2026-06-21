import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", "[data-theme=\"dark\"]"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
