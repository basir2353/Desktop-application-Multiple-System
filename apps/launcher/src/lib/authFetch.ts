import {
  AuthClient,
  isLikelyNetworkFailure,
  platformFetch,
  wrapNetworkError,
} from "@platform/auth-client";
import { decodeAccessToken, isAccessTokenExpired } from "./jwt";
import { getApiBaseUrl } from "./apiBase";
import { useSessionStore } from "../stores/sessionStore";

let refreshInFlight: Promise<string> | null = null;

export class SessionExpiredError extends Error {
  constructor(message = "Session expired. Sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

async function refreshAccessToken(opts?: { clearOnFailure?: boolean }): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const clearOnFailure = opts?.clearOnFailure !== false;

  refreshInFlight = (async () => {
    const { refreshToken, setTokens, clear } = useSessionStore.getState();
    if (!refreshToken) {
      if (clearOnFailure) clear();
      throw new SessionExpiredError();
    }

    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.refresh(refreshToken);
      const claims = decodeAccessToken(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken, claims);
      return tokens.accessToken;
    } catch {
      // Soft refresh must not wipe a still-valid access token (hosted APIs may
      // reject refresh while the session JWT is fine — that was bouncing Admin
      // back to the role select screen right after sign-in).
      if (clearOnFailure) clear();
      throw new SessionExpiredError();
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Soft-refresh the access token so Super Admin org module ceilings apply
 * without forcing the user through a full sign-out / sign-in.
 */
export async function refreshSessionPermissions(): Promise<boolean> {
  const { refreshToken, accessToken } = useSessionStore.getState();
  if (!refreshToken) return false;
  const accessStillValid = Boolean(accessToken && !isAccessTokenExpired(accessToken));
  try {
    await refreshAccessToken({ clearOnFailure: !accessStillValid });
    return true;
  } catch {
    return false;
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  return (
    err instanceof SessionExpiredError ||
    (err instanceof Error && err.message === "Session expired. Sign in again.")
  );
}

/** Returns a valid access token, refreshing proactively when expired. */
export async function getValidAccessToken(): Promise<string> {
  const { accessToken, refreshToken, clear } = useSessionStore.getState();
  if (!accessToken) throw new SessionExpiredError();

  if (!isAccessTokenExpired(accessToken)) return accessToken;
  if (!refreshToken) {
    clear();
    throw new SessionExpiredError();
  }

  return refreshAccessToken();
}

/** Restore session on cold start when the access token has expired but refresh is still valid. */
export async function bootstrapSession(): Promise<void> {
  const { accessToken, refreshToken } = useSessionStore.getState();
  if (!accessToken || !refreshToken) return;
  if (!isAccessTokenExpired(accessToken)) return;
  try {
    await refreshAccessToken();
  } catch {
    /* refreshAccessToken clears session on failure */
  }
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;

  async function request(token: string): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body != null && !headers.has("Content-Type") && typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
    }
    try {
      return await platformFetch(url, { ...init, headers });
    } catch (err) {
      if (isLikelyNetworkFailure(err)) {
        throw wrapNetworkError(getApiBaseUrl(), err);
      }
      throw err;
    }
  }

  let token = await getValidAccessToken();
  let res = await request(token);

  if (res.status === 401) {
    const { refreshToken, clear } = useSessionStore.getState();
    if (!refreshToken) {
      clear();
      throw new SessionExpiredError();
    }
    token = await refreshAccessToken();
    res = await request(token);
    if (res.status === 401) {
      clear();
      throw new SessionExpiredError();
    }
  }

  return res;
}
