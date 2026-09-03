/** Live Railway API — canonical URL from repo root local/live-env.json */
export const RAILWAY_API_BASE_URL = "https://backend-desktop-production-600b.up.railway.app";

const DEPRECATED_LIVE_URLS = new Set([
  "https://platformapi-production-39aa.up.railway.app",
]);

function normalizeLiveUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed || DEPRECATED_LIVE_URLS.has(trimmed)) return RAILWAY_API_BASE_URL;
  return trimmed;
}

export function getApiBaseUrl(): string {
  const fromExpo = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const url = (fromExpo ?? RAILWAY_API_BASE_URL).trim().replace(/\/$/, "");
  return normalizeLiveUrl(url || RAILWAY_API_BASE_URL);
}
