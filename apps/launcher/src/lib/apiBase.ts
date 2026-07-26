import { useDataModeStore, type ApiPreset } from "../stores/dataModeStore";

/** Hosted Railway API (production). */
export const LIVE_API_URL = "https://backend-desktop-production-5505.up.railway.app";

/** Local dev API — run `pnpm dev:api` on this machine. */
export const LOCAL_API_URL = "http://127.0.0.1:3000";

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return LIVE_API_URL;
  try {
    new URL(trimmed);
  } catch {
    return LIVE_API_URL;
  }
  return trimmed;
}

function builtInApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }
  return LIVE_API_URL;
}

function urlForPreset(preset: ApiPreset, customUrl: string): string {
  if (preset === "local") return LOCAL_API_URL;
  if (preset === "live") return LIVE_API_URL;
  if (preset === "custom" && customUrl.trim()) return normalizeApiBaseUrl(customUrl);
  return builtInApiBaseUrl();
}

/** API base URL — dev uses `.env`; installed .exe uses Live / Local / Custom preset. */
export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (import.meta.env.DEV && fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }

  const { apiPreset, cloudApiUrl } = useDataModeStore.getState();
  return urlForPreset(apiPreset, cloudApiUrl);
}

export function describeApiPreset(preset: ApiPreset): string {
  return urlForPreset(preset, useDataModeStore.getState().cloudApiUrl);
}
