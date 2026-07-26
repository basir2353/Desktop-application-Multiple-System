/** Hosted Railway API (production) — always used by desktop + browser. */
export const LIVE_API_URL = "https://backend-desktop-production-5505.up.railway.app";

/** @deprecated Kept for Sync/docs references only — app no longer switches to local API. */
export const LOCAL_API_URL = "http://127.0.0.1:3000";

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return LIVE_API_URL;
  try {
    new URL(trimmed);
  } catch {
    return LIVE_API_URL;
  }
  // Never silently fall back to a local Nest process from env misconfig.
  if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
    return LIVE_API_URL;
  }
  return trimmed;
}

/**
 * Always the live Railway API.
 * Optional `VITE_API_BASE_URL` may override only when it is a non-local https host.
 */
export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }
  return LIVE_API_URL;
}

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
