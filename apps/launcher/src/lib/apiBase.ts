import { useDataModeStore } from "../stores/dataModeStore";

/** Live Railway API — override with VITE_API_BASE_URL for local dev. */
const DEFAULT_API = "https://backend-desktop-production-5505.up.railway.app";

/** Retired / broken hosts that still 500 on login — always remap to the live API. */
const BROKEN_API_HOSTS = new Set([
  "platformapi-production-39aa.up.railway.app",
]);

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_API;
  try {
    const host = new URL(trimmed).host.toLowerCase();
    if (BROKEN_API_HOSTS.has(host)) return DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
  return trimmed;
}

function builtInApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }
  return DEFAULT_API;
}

/** API base URL — build-time default or runtime override from Sync settings (cloud mode). */
export function getApiBaseUrl(): string {
  const override = useDataModeStore.getState().cloudApiUrl?.trim();
  if (override) return normalizeApiBaseUrl(override);
  return builtInApiBaseUrl();
}
