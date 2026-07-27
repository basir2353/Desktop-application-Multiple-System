/**
 * Live hosted Nest API (Railway Postgres).
 * Health: https://backend-desktop-production-5505.up.railway.app/health
 */
export const RAILWAY_API_URL = "https://backend-desktop-production-5505.up.railway.app";

/** Default live URL — prefer build-time inject, else Railway. */
export const LIVE_API_URL = (
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) ||
  RAILWAY_API_URL
).replace(/\/$/, "");

export const LOCAL_API_URL = "http://127.0.0.1:3000";

type ApiPreset = "live" | "local" | "custom";

function readPersistedApiChoice(): { apiPreset: ApiPreset; cloudApiUrl: string } {
  try {
    const raw = localStorage.getItem("platform-data-mode-v2");
    if (!raw) return { apiPreset: "live", cloudApiUrl: "" };
    const parsed = JSON.parse(raw) as {
      state?: { apiPreset?: ApiPreset; cloudApiUrl?: string };
    };
    return {
      apiPreset: parsed.state?.apiPreset ?? "live",
      cloudApiUrl: (parsed.state?.cloudApiUrl ?? "").trim().replace(/\/$/, ""),
    };
  } catch {
    return { apiPreset: "live", cloudApiUrl: "" };
  }
}

/** Resolves the API host for desktop/web (respects Live / Local / Custom preset). */
export function getApiBaseUrl(): string {
  const { apiPreset, cloudApiUrl } = readPersistedApiChoice();
  if (apiPreset === "local") return LOCAL_API_URL;
  if (apiPreset === "custom" && cloudApiUrl) return cloudApiUrl;
  return LIVE_API_URL;
}

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
