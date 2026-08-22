/** API helpers for FPRA / Real PRA fiscal invoices. */

import {
  issuePraInvoiceResultSchema,
  praFiscalInvoiceSchema,
  preparePraClientPostResultSchema,
  type ConfirmPraClientPostInput,
  type IssuePraInvoiceInput,
  type IssuePraInvoiceResult,
  type PraFiscalInvoice,
  type PreparePraClientPostInput,
  type PreparePraClientPostResult,
  type TaxAuthorityFeatures,
} from "@platform/contracts";
import { authFetch } from "./authFetch";
import {
  fetchTaxAuthorityFeatures as fetchTaxFeaturesBase,
  updateTaxAuthorityFeatures as updateTaxFeaturesBase,
} from "./taxAuthorityApi";

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!err?.message) return `Request failed: ${res.status}`;
  return Array.isArray(err.message) ? err.message.join(", ") : err.message;
}

/** Normalize older API responses that omit fake/real / allowed flags. */
export function normalizeTaxFeatures(raw: TaxAuthorityFeatures): TaxAuthorityFeatures {
  let praFakeEnabled = Boolean(raw.praFakeEnabled);
  let praRealEnabled = Boolean(raw.praRealEnabled);
  const praEnabled = Boolean(raw.praEnabled) || praFakeEnabled || praRealEnabled;
  if (praEnabled && !praFakeEnabled && !praRealEnabled) {
    praRealEnabled = true;
  }
  // Prefer Real when both flags are set (matches Pay / resolveAutoPraMode).
  if (praFakeEnabled && praRealEnabled) {
    praFakeEnabled = false;
  }
  const fbrEnabled = Boolean(raw.fbrEnabled);
  return {
    fbrAllowed: Boolean(raw.fbrAllowed) || fbrEnabled,
    praFakeAllowed: Boolean(raw.praFakeAllowed) || praFakeEnabled,
    praRealAllowed: Boolean(raw.praRealAllowed) || praRealEnabled,
    fbrEnabled,
    praEnabled: praFakeEnabled || praRealEnabled,
    praFakeEnabled,
    praRealEnabled,
  };
}

export async function fetchTaxFeaturesNormalized(): Promise<TaxAuthorityFeatures> {
  const raw = await fetchTaxFeaturesBase();
  return normalizeTaxFeatures(raw);
}

export async function updateTaxFeaturesNormalized(patch: {
  fbrEnabled?: boolean;
  praEnabled?: boolean;
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): Promise<TaxAuthorityFeatures> {
  const raw = await updateTaxFeaturesBase(patch);
  return normalizeTaxFeatures(raw);
}

export async function issuePraInvoice(input: IssuePraInvoiceInput): Promise<IssuePraInvoiceResult> {
  const res = await authFetch("/v1/pra/issue-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return issuePraInvoiceResultSchema.parse(await res.json());
}

export async function preparePraClientPost(
  input: PreparePraClientPostInput,
): Promise<PreparePraClientPostResult> {
  const res = await authFetch("/v1/pra/prepare-client-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return preparePraClientPostResultSchema.parse(await res.json());
}

export async function confirmPraClientPost(
  input: ConfirmPraClientPostInput,
): Promise<IssuePraInvoiceResult> {
  const res = await authFetch("/v1/pra/confirm-client-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return issuePraInvoiceResultSchema.parse(await res.json());
}

export async function fetchPraFiscalForSource(input: {
  branchCode: string;
  sourceType: "bill" | "store_sale" | "pharmacy_sale";
  sourceId: string;
}): Promise<PraFiscalInvoice | null> {
  const params = new URLSearchParams({
    branchCode: input.branchCode,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  });
  const res = await authFetch(`/v1/pra/fiscal-for-source?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const json: unknown = await res.json();
  if (!json) return null;
  return praFiscalInvoiceSchema.parse(json);
}

/** Map official PRA URL to same-origin Vite proxy (avoids browser CORS). */
export function praPostUrlForClient(postUrl: string): string {
  try {
    const u = new URL(postUrl);
    if (/ims\.pral\.com\.pk$/i.test(u.hostname)) {
      return `/pra-ims${u.pathname}${u.search}`;
    }
  } catch {
    /* keep original */
  }
  return postUrl;
}

export function isPraNetworkFailureMessage(message: string): boolean {
  return /fetch failed|network timeout|could not reach|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|TLS|socket disconnected|PRA network error|secure TLS|Client network socket|whitelist|unreachable/i.test(
    message,
  );
}

function isHtmlResponseBody(text: string): boolean {
  const t = text.trim().slice(0, 80).toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html");
}

function shortenPraClientError(text: string): string {
  if (isHtmlResponseBody(text)) {
    return "Got an HTML page instead of PRA JSON (proxy/SPA miss). Desktop will retry via native PRA post.";
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function isTauriRuntime(): boolean {
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}

/**
 * Post PRAL Live/PostData from this machine (shop IP).
 * Desktop (Tauri) uses native HTTPS first — Vite /pra-ims is browser-dev only and
 * often returns the SPA HTML shell in packaged builds.
 */
export async function postPraPayloadFromClient(input: {
  postUrl: string;
  bearerToken: string;
  payload: Record<string, unknown>;
}): Promise<{ invoiceNumber: string; raw: unknown }> {
  const body = JSON.stringify(input.payload);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.bearerToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const tryFetch = async (url: string) => {
    const res = await fetch(url, { method: "POST", headers, body });
    const text = await res.text();
    if (isHtmlResponseBody(text)) {
      throw new Error(
        "PRA proxy returned HTML (not e-IMS). Use desktop native post or fix /pra-ims proxy.",
      );
    }
    let json: unknown = null;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
    return { status: res.status, json, text };
  };

  const errors: string[] = [];

  // 1) Tauri native HTTPS first (desktop EXE + tauri dev) — real shop IP, no CORS/proxy.
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const text = await invoke<string>("pra_http_post", {
        url: input.postUrl,
        token: input.bearerToken,
        body,
      });
      if (isHtmlResponseBody(text)) {
        throw new Error("Native PRA post returned HTML — unexpected.");
      }
      let json: unknown = null;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { message: text };
      }
      const parsed = parsePraPostResponse(200, json, text);
      if (parsed) return parsed;
      errors.push(shortenPraClientError(text));
    } catch (err) {
      errors.push(shortenPraClientError(err instanceof Error ? err.message : String(err)));
    }
  }

  // 2) Vite /pra-ims proxy (browser `pnpm dev:web` only)
  const proxied = praPostUrlForClient(input.postUrl);
  if (proxied !== input.postUrl) {
    try {
      const r = await tryFetch(proxied);
      const parsed = parsePraPostResponse(r.status, r.json, r.text);
      if (parsed) return parsed;
      errors.push(shortenPraClientError(r.text));
    } catch (err) {
      errors.push(shortenPraClientError(err instanceof Error ? err.message : String(err)));
    }
  }

  // 3) Direct (rare — CORS usually blocks browsers)
  try {
    const r = await tryFetch(input.postUrl);
    const parsed = parsePraPostResponse(r.status, r.json, r.text);
    if (parsed) return parsed;
    errors.push(shortenPraClientError(r.text));
  } catch (err) {
    errors.push(shortenPraClientError(err instanceof Error ? err.message : String(err)));
  }

  const detail = errors.find((e) => e && !/html page|spa miss|proxy returned html/i.test(e)) || errors[0];
  throw new Error(
    detail
      ? `PRA client post failed: ${detail}`
      : "PRA client post failed — could not reach e-IMS from this machine.",
  );
}

/**
 * Live ping from this POS (shop IP). Success = PRA reachable + token accepted
 * (POSID 0 ping does not require InvoiceNumber).
 */
export async function pingPraFromClient(input: {
  postUrl: string;
  bearerToken: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true; detail: string }> {
  const body = JSON.stringify(input.payload);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.bearerToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const tryOnce = async (url: string) => {
    const res = await fetch(url, { method: "POST", headers, body });
    const text = await res.text();
    if (isHtmlResponseBody(text)) {
      throw new Error("PRA proxy returned HTML (not e-IMS)");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid Credentials — check Bearer Token / IP whitelist");
    }
    if (res.status >= 500) {
      throw new Error(`PRA Server Unavailable (${res.status})`);
    }
    // Any non-auth response means we reached PRA with a usable token.
    return text.slice(0, 180) || `HTTP ${res.status}`;
  };

  const errors: string[] = [];

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const text = await invoke<string>("pra_http_post", {
        url: input.postUrl,
        token: input.bearerToken,
        body,
      });
      if (isHtmlResponseBody(text)) {
        throw new Error("Native PRA ping returned HTML");
      }
      if (/401|403|unauthorized|invalid/i.test(text)) {
        throw new Error("Invalid Credentials — check Bearer Token / IP whitelist");
      }
      return { ok: true, detail: text.slice(0, 180) };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const proxied = praPostUrlForClient(input.postUrl);
  if (proxied !== input.postUrl) {
    try {
      const detail = await tryOnce(proxied);
      return { ok: true, detail };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const detail = await tryOnce(input.postUrl);
    return { ok: true, detail };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  throw new Error(errors[0] || "Could not reach PRA from this POS.");
}

function parsePraPostResponse(
  status: number,
  json: unknown,
  text: string,
): { invoiceNumber: string; raw: unknown } | null {
  if (isHtmlResponseBody(text)) {
    throw new Error(
      "PRA endpoint returned HTML instead of JSON (proxy/SPA miss). Retry on desktop native post.",
    );
  }
  if (status === 401 || status === 403) {
    throw new Error("Invalid Credentials — check Bearer Token / IP whitelist");
  }
  const obj = typeof json === "object" && json ? (json as Record<string, unknown>) : null;
  const code = obj && "Code" in obj ? String(obj.Code) : "";
  const rawMsg =
    obj && "Response" in obj
      ? String(obj.Response)
      : obj && "message" in obj
        ? String(obj.message)
        : text.slice(0, 200);
  const responseMsg = isHtmlResponseBody(rawMsg) ? "" : rawMsg;

  if (status >= 200 && status < 300 && (!code || code === "100")) {
    const invoiceNumber = extractPraInvoiceNumber(obj, text);
    if (invoiceNumber) {
      return { invoiceNumber, raw: json };
    }
    // Success-shaped response without a usable InvoiceNumber — fail loudly so Close
    // does not silently print a blank Real PRA slip.
    throw new Error(
      responseMsg ||
        "PRA accepted the request but did not return InvoiceNumber. Check POS ID / Production token / IP whitelist.",
    );
  }
  if (code && code !== "100") {
    throw new Error(responseMsg || `PRA rejected invoice (Code ${code})`);
  }
  return null;
}

/** Pull InvoiceNumber from common PRA / proxy response shapes. */
function extractPraInvoiceNumber(
  obj: Record<string, unknown> | null,
  text: string,
): string {
  const candidates: unknown[] = [];
  if (obj) {
    candidates.push(
      obj.InvoiceNumber,
      obj.invoiceNumber,
      obj.InvoiceNo,
      obj.invoiceNo,
      obj.INVOICENUMBER,
    );
    const data = obj.data;
    if (typeof data === "object" && data) {
      const nested = data as Record<string, unknown>;
      candidates.push(nested.InvoiceNumber, nested.invoiceNumber, nested.InvoiceNo);
    }
    const result = obj.result;
    if (typeof result === "object" && result) {
      const nested = result as Record<string, unknown>;
      candidates.push(nested.InvoiceNumber, nested.invoiceNumber, nested.InvoiceNo);
    }
  }
  for (const value of candidates) {
    const num = String(value ?? "").trim();
    if (num && !/^not available$/i.test(num) && !/^null$/i.test(num)) {
      return num;
    }
  }
  const match = text.match(/"InvoiceNumber"\s*:\s*"([^"]+)"/i);
  if (match?.[1] && !/^not available$/i.test(match[1].trim())) {
    return match[1].trim();
  }
  return "";
}
