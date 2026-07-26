import { useDataModeStore } from "../stores/dataModeStore";

/** Live Railway API — override with VITE_API_BASE_URL for local dev. */
const DEFAULT_API = "https://platformapi-production-39aa.up.railway.app";

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_API;
  try {
    new URL(trimmed);
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
