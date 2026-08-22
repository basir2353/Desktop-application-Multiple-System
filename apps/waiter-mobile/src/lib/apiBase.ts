/** Live Railway API — override with EXPO_PUBLIC_API_BASE_URL for local dev. */
export const RAILWAY_API_BASE_URL = "https://backend-desktop-production-600b.up.railway.app";

export function getApiBaseUrl(): string {
  const fromExpo = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const url = (fromExpo ?? RAILWAY_API_BASE_URL).trim().replace(/\/$/, "");
  return url || RAILWAY_API_BASE_URL;
}
