import { isLikelyNetworkFailure, mobileFetch, wrapMobileNetworkError } from "./mobileFetch";
import { refreshSession } from "./sessionAuth";
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
      const tokens = await refreshSession(refreshToken);
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

function authHeaders(init: RequestInit | undefined, token: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) headers[key] = value;
    } else {
      Object.assign(headers, init.headers);
    }
  }
  headers.Authorization = `Bearer ${token}`;
  if (
    init?.body != null &&
    !headers["Content-Type"] &&
    !headers["content-type"] &&
    typeof init.body === "string"
  ) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;

  async function request(token: string): Promise<Response> {
    try {
      const res = await mobileFetch(url, {
        ...init,
        headers: authHeaders(init, token),
      });
      markOnline();
      return res;
    } catch (err) {
      markOffline();
      if (isLikelyNetworkFailure(err)) {
        throw wrapMobileNetworkError(getApiBaseUrl(), err);
      }
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
