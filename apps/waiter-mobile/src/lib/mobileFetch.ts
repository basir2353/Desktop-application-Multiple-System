import { Platform } from "react-native";

const ANDROID_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = Platform.OS === "android" ? 4 : 2;

function plainHeaders(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!init?.headers) return headers;
  const raw = init.headers;
  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  if (Array.isArray(raw)) {
    for (const [key, value] of raw) headers[key] = value;
    return headers;
  }
  return { ...raw };
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const message = err.message;
  return (
    message === "Network request failed" ||
    message === "Failed to fetch" ||
    message === "Load failed" ||
    message === "Aborted" ||
    /network|fetch|timeout|timed?\s*out|abort|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket|SSL|TLS/i.test(
      message,
    )
  );
}

export function isLikelyNetworkFailure(err: unknown): boolean {
  return isRetryableNetworkError(err);
}

export function wrapMobileNetworkError(baseUrl: string, err: unknown): Error {
  const detail = err instanceof Error ? err.message : String(err);
  return new Error(
    `Cannot reach the server at ${baseUrl}. Turn on mobile data or Wi‑Fi, wait a few seconds, and try again. (${detail})`,
  );
}

/** RN-safe fetch with plain headers, long timeout, and retries (Railway cold starts). */
export async function mobileFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = plainHeaders(init);
  const method = init?.method ?? "GET";
  const body = init?.body;
  const timeoutMs = Platform.OS === "android" ? ANDROID_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt + 1 >= MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}
