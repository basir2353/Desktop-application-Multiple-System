import { useDataModeStore } from "../stores/dataModeStore";

const DEFAULT_DEV_API = "http://127.0.0.1:3000";

function builtInApiBaseUrl(): string {
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

/** API base URL — build-time default or runtime override from Sync settings (cloud mode). */
export function getApiBaseUrl(): string {
  const override = useDataModeStore.getState().cloudApiUrl?.trim();
  if (override) return override.replace(/\/$/, "");
  return builtInApiBaseUrl();
}
