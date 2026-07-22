import { useDataModeStore } from "../stores/dataModeStore";

/** Live Railway API — override with VITE_API_BASE_URL for local dev. */
const DEFAULT_API = "https://platformapi-production-39aa.up.railway.app";

function builtInApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return DEFAULT_API;
}

/** API base URL — build-time default or runtime override from Sync settings (cloud mode). */
export function getApiBaseUrl(): string {
  const override = useDataModeStore.getState().cloudApiUrl?.trim();
  if (override) return override.replace(/\/$/, "");
  return builtInApiBaseUrl();
}
