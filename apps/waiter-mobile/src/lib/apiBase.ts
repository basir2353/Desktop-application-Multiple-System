import Constants from "expo-constants";

<<<<<<< Updated upstream
/** Live Railway API — override with EXPO_PUBLIC_API_BASE_URL for local dev. */
export const RAILWAY_API_BASE_URL = "https://backend-desktop-production-5505.up.railway.app";
=======
/** Hosted API default — override with EXPO_PUBLIC_API_BASE_URL for local. */
export const DEFAULT_API_BASE_URL = "https://platformapi-production-39aa.up.railway.app";
>>>>>>> Stashed changes

function defaultApiBaseUrl(): string {
  return DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl(): string {
  const fromEnv = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");

  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (extra?.apiBaseUrl?.trim()) return extra.apiBaseUrl.replace(/\/$/, "");

  return defaultApiBaseUrl();
}
