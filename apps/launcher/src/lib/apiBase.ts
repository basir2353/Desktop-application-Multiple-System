/**
 * Single live Railway API for the whole app (staff, POS, Super Admin).
 */
export const RAILWAY_API_URL = "https://backend-desktop-production-600b.up.railway.app";

const API_RESOLVED_KEY = "pops-railway-api-resolved-v1";

/** Retired Railway hosts — redirect to the active live service. */
const DEPRECATED_LIVE_URLS = new Set([
  "https://platformapi-production-39aa.up.railway.app",
  "https://backend-desktop-production-5505.up.railway.app",
]);

/** Baked at build time — overrides default when set. */
const BAKED_API_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

function normalizeLiveUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed || DEPRECATED_LIVE_URLS.has(trimmed)) return RAILWAY_API_URL;
  return trimmed;
}

export const LOCAL_API_URL = "http://127.0.0.1:3000";

type ApiPreset = "live" | "local" | "custom";

function readPersistedApiChoice(): { apiPreset: ApiPreset; cloudApiUrl: string } {
  try {
    const raw = localStorage.getItem("platform-data-mode-v2");
    if (!raw) return { apiPreset: "live", cloudApiUrl: "" };
    const parsed = JSON.parse(raw) as {
      state?: { apiPreset?: ApiPreset; cloudApiUrl?: string };
    };
    return {
      apiPreset: parsed.state?.apiPreset ?? "live",
      cloudApiUrl: (parsed.state?.cloudApiUrl ?? "").trim().replace(/\/$/, ""),
    };
  } catch {
    return { apiPreset: "live", cloudApiUrl: "" };
  }
}

function readResolvedLiveUrl(): string | null {
  try {
    const v = localStorage.getItem(API_RESOLVED_KEY);
    if (!v) return null;
    return normalizeLiveUrl(v);
  } catch {
    return null;
  }
}

export function persistResolvedLiveUrl(url: string): void {
  try {
    localStorage.setItem(API_RESOLVED_KEY, normalizeLiveUrl(url));
  } catch {
    /* ignore */
  }
}

export function getLiveApiUrl(): string {
  return normalizeLiveUrl(BAKED_API_URL || RAILWAY_API_URL);
}

export function describeLiveServer(): {
  url: string;
  dbLabel: string;
} {
  return {
    url: getLiveApiUrl(),
    dbLabel: "Postgres (Railway)",
  };
}

export function describeApiServer(): {
  preset: ApiPreset;
  liveLabel: string | null;
  url: string;
  dbLabel: string | null;
} {
  const { apiPreset, cloudApiUrl } = readPersistedApiChoice();
  if (apiPreset === "local") {
    return { preset: "local", liveLabel: null, url: LOCAL_API_URL, dbLabel: null };
  }
  if (apiPreset === "custom" && cloudApiUrl) {
    return { preset: "custom", liveLabel: null, url: cloudApiUrl, dbLabel: null };
  }
  const live = describeLiveServer();
  return {
    preset: "live",
    liveLabel: "Live",
    url: live.url,
    dbLabel: live.dbLabel,
  };
}

/** Resolves the API host for the whole app. Local/custom presets still win. */
export function getApiBaseUrl(): string {
  const { apiPreset, cloudApiUrl } = readPersistedApiChoice();
  if (apiPreset === "local") return LOCAL_API_URL;
  if (apiPreset === "custom" && cloudApiUrl) return normalizeLiveUrl(cloudApiUrl);
  return readResolvedLiveUrl() ?? getLiveApiUrl();
}

export async function resolveLiveApiBaseUrl(): Promise<string> {
  const { apiPreset, cloudApiUrl } = readPersistedApiChoice();
  if (apiPreset === "local") return LOCAL_API_URL;
  if (apiPreset === "custom" && cloudApiUrl) return normalizeLiveUrl(cloudApiUrl);

  const live = getLiveApiUrl();
  persistResolvedLiveUrl(live);
  return live;
}

export const LIVE_API_URL = RAILWAY_API_URL;

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
