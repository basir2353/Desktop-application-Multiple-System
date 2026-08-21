import { Platform } from "react-native";
import { enqueueHttpRequest } from "@platform/auth-client";

const ANDROID_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = Platform.OS === "android" ? 3 : 2;

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

/**
 * Android RN `fetch` sometimes throws "Network request failed" while XHR still works
 * (flaky TLS / connection reuse on slow mobile networks).
 */
function xhrRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: BodyInit | null | undefined,
  timeoutMs: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) xhr.setRequestHeader(key, String(value));
    }
    xhr.onload = () => {
      const responseHeaders = new Headers();
      const raw = xhr.getAllResponseHeaders() || "";
      for (const line of raw.trim().split(/[\r\n]+/)) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          responseHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
        }
      }
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
        }),
      );
    };
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Aborted"));
    xhr.onabort = () => reject(new Error("Aborted"));
    xhr.send(typeof body === "string" || body == null ? body ?? null : String(body));
  });
}

async function nativeFetchOnce(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: BodyInit | null | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function mobileFetchWithRetries(url: string, init?: RequestInit): Promise<Response> {
  const headers = plainHeaders(init);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body;
  const timeoutMs = Platform.OS === "android" ? ANDROID_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const isSafeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const maxAttempts = isSafeMethod ? MAX_ATTEMPTS : 1;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await nativeFetchOnce(url, method, headers, body, timeoutMs);
    } catch (err) {
      lastError = err;
      if (Platform.OS === "android" && isRetryableNetworkError(err)) {
        try {
          return await xhrRequest(url, method, headers, body, timeoutMs);
        } catch (xhrErr) {
          lastError = xhrErr;
        }
      }
      if (!isSafeMethod || !isRetryableNetworkError(err) || attempt + 1 >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** RN-safe fetch with queue, plain headers, long timeout, retries, and Android XHR fallback. */
export async function mobileFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isSafeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
  return enqueueHttpRequest(() => mobileFetchWithRetries(url, init), {
    method,
    key: isSafeMethod ? `${method} ${url}` : undefined,
  });
}
