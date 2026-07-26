/**
 * Live data API — Nest process talking to Railway Postgres.
 * Public railway.app is currently 502; once /health is ok, set this to RAILWAY_API_URL.
 */
export const RAILWAY_API_URL = "https://backend-desktop-production-5505.up.railway.app";
export const LIVE_API_URL = "http://127.0.0.1:3000";

/** @deprecated */
export const LOCAL_API_URL = "http://127.0.0.1:3000";

/** Always the live-data API (Railway database). */
export function getApiBaseUrl(): string {
  return LIVE_API_URL.replace(/\/$/, "");
}

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
