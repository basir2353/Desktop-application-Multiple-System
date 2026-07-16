import { getApiBaseUrl } from "./apiBase";
import {
  isLikelyNetworkFailure,
  mobileFetch,
  wrapMobileNetworkError,
} from "./mobileFetch";
import { parseTokenPair, type TokenPair } from "./tokenPair";

async function postJson(path: string, body: unknown): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  try {
    return await mobileFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      throw wrapMobileNetworkError(getApiBaseUrl(), err);
    }
    throw err;
  }
}

export async function passwordLogin(email: string, password: string): Promise<TokenPair> {
  const res = await postJson("/v1/auth/login", { email: email.trim(), password });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      let message = "Invalid email or password.";
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // keep default
      }
      throw new Error(message);
    }
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  return parseTokenPair(await res.json());
}

export async function refreshSession(refreshToken: string): Promise<TokenPair> {
  const res = await postJson("/v1/auth/refresh", { refreshToken });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired. Sign in again.");
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text}`);
  }
  return parseTokenPair(await res.json());
}

export async function pinLogin(branchCode: string, pin: string): Promise<TokenPair> {
  const res = await postJson("/v1/auth/pin-login", {
    branchCode: branchCode.trim().toUpperCase(),
    pin,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    if (res.status === 401) {
      throw new Error(
        err?.message ??
          "Invalid branch code or PIN. Use email sign-in, or set your PIN in the app after signing in.",
      );
    }
    const fallback =
      res.status === 404
        ? "PIN login is not available on this API yet. Use email sign-in instead."
        : `PIN login failed: ${res.status}`;
    throw new Error(err?.message ?? fallback);
  }
  return parseTokenPair(await res.json());
}
