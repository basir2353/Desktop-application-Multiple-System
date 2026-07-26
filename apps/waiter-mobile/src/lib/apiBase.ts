import Constants from "expo-constants";

/** Live Railway API — override with EXPO_PUBLIC_API_BASE_URL for local dev. */
export const RAILWAY_API_BASE_URL = "https://backend-desktop-production-5505.up.railway.app";

export function getApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (extra?.apiBaseUrl?.trim()) return extra.apiBaseUrl.replace(/\/$/, "");

  const fromEnv = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");

  return RAILWAY_API_BASE_URL;
}
