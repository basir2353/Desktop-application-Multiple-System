/**
 * One live Railway at a time for the whole app (staff, POS, Super Admin).
 * No role split — Active OLD = everyone on OLD; Active NEW = everyone on NEW.
 */
export const OLD_RAILWAY_API_URL = "https://backend-desktop-production-5505.up.railway.app";
export const NEW_RAILWAY_API_URL = "https://backend-desktop-production-600b.up.railway.app";

export type LiveServerEnv = "old" | "new";

/** Baked at build time from local/live-env.json — used on fresh install before any switch. */
const BAKED_API_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
const BAKED_LIVE_ENV: LiveServerEnv =
  import.meta.env.VITE_LIVE_ENV === "new"
    ? "new"
    : import.meta.env.VITE_LIVE_ENV === "old"
      ? "old"
      : BAKED_API_URL.includes("600b")
        ? "new"
        : "old";

/** Fallback when no live env is stored yet. */
export const RAILWAY_API_URL = BAKED_API_URL || OLD_RAILWAY_API_URL;

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

function readLiveEnv(): LiveServerEnv {
  try {
    const raw = localStorage.getItem("platform-sa-env-v1");
    if (!raw) return BAKED_LIVE_ENV;
    const parsed = JSON.parse(raw) as { state?: { env?: string } };
    return parsed.state?.env === "new" ? "new" : "old";
  } catch {
    return BAKED_LIVE_ENV;
  }
}

export function getLiveApiUrl(): string {
  return readLiveEnv() === "new" ? NEW_RAILWAY_API_URL : OLD_RAILWAY_API_URL;
}

export function getLiveServerEnv(): LiveServerEnv {
  return readLiveEnv();
}

export function describeLiveServer(): {
  env: LiveServerEnv;
  label: "OLD" | "NEW";
  url: string;
  dbLabel: string;
} {
  const env = readLiveEnv();
  return {
    env,
    label: env === "new" ? "NEW" : "OLD",
    url: env === "new" ? NEW_RAILWAY_API_URL : OLD_RAILWAY_API_URL,
    dbLabel: env === "new" ? "NEW Postgres (acela)" : "OLD Postgres (hayabusa)",
  };
}

export function describeApiServer(): {
  preset: ApiPreset;
  liveLabel: "OLD" | "NEW" | null;
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
    liveLabel: live.label,
    url: live.url,
    dbLabel: live.dbLabel,
  };
}

/** Resolves the API host for the whole app. Local/custom presets still win. */
export function getApiBaseUrl(): string {
  const { apiPreset, cloudApiUrl } = readPersistedApiChoice();
  if (apiPreset === "local") return LOCAL_API_URL;
  if (apiPreset === "custom" && cloudApiUrl) return cloudApiUrl;
  return getLiveApiUrl();
}

/** Same as getLiveApiUrl — used by POS/PRA and the Live preset hint. */
export const LIVE_API_URL = OLD_RAILWAY_API_URL;

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
