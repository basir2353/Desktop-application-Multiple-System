import { AuthClient } from "@platform/auth-client";
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

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, setTokens, clear } = useSessionStore.getState();
    if (!refreshToken) {
      clear();
      throw new SessionExpiredError();
    }

    const client = new AuthClient({ baseUrl: getApiBaseUrl() });
    const tokens = await client.refresh(refreshToken);
    const claims = decodeAccessToken(tokens.accessToken);
    setTokens(tokens.accessToken, tokens.refreshToken, claims);
    return tokens.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
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
    return fetch(url, { ...init, headers });
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
