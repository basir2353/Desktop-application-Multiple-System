import { AuthClient } from "@platform/auth-client";
import { decodeAccessToken, isAccessTokenExpired } from "./jwt";
import { getApiBaseUrl } from "./apiBase";
import { markOnline, markOffline } from "../stores/connectivityStore";
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
    const { refreshToken, setTokens, clear, waiterEmail } = useSessionStore.getState();
    if (!refreshToken) {
      clear();
      throw new SessionExpiredError();
    }

    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.refresh(refreshToken);
      const claims = decodeAccessToken(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken, claims, waiterEmail ?? undefined);
      return tokens.accessToken;
    } catch {
      clear();
      throw new SessionExpiredError();
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

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
    try {
      const res = await fetch(url, { ...init, headers });
      markOnline();
      return res;
    } catch (err) {
      markOffline();
      throw err;
    }
  }

  let token: string;
  try {
    token = await getValidAccessToken();
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    throw err;
  }

  let res = await request(token);

  if (res.status === 401) {
    const { refreshToken, clear } = useSessionStore.getState();
    if (!refreshToken) {
      clear();
      throw new SessionExpiredError();
    }
    try {
      token = await refreshAccessToken();
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      clear();
      throw new SessionExpiredError();
    }
    res = await request(token);
    if (res.status === 401) {
      clear();
      throw new SessionExpiredError();
    }
  }

  return res;
}
