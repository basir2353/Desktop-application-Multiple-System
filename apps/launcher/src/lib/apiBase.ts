import { useDataModeStore } from "../stores/dataModeStore";

const DEFAULT_API = "https://backend-desktop-production-5505.up.railway.app";

function builtInApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return DEFAULT_API;
  }
  throw new Error(
    "Missing VITE_API_BASE_URL. For release builds, set it in .env at the repository root (see .env.example).",
  );
}

/** API base URL — build-time default or runtime override from Sync settings (cloud mode). */
export function getApiBaseUrl(): string {
  const override = useDataModeStore.getState().cloudApiUrl?.trim();
  if (override) return override.replace(/\/$/, "");
  return builtInApiBaseUrl();
}
