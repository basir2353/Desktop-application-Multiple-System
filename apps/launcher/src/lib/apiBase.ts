const DEFAULT_DEV_API = "http://127.0.0.1:3000";

export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return DEFAULT_DEV_API;
  }
  throw new Error(
    "Missing VITE_API_BASE_URL. For release builds, set it in .env at the repository root (see .env.example).",
  );
}
