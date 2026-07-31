import {
  issuePraInvoiceResultSchema,
  praDashboardSchema,
  praFiscalInvoiceSchema,
  praReportsSchema,
  preparePraClientPostResultSchema,
  taxAuthorityStatusSchema,
  type ConfirmPraClientPostInput,
  type IssuePraInvoiceInput,
  type IssuePraInvoiceResult,
  type PraDashboard,
  type PraFiscalInvoice,
  type PraInvoiceMode,
  type PraReportPeriod,
  type PraReports,
  type PreparePraClientPostInput,
  type PreparePraClientPostResult,
  type TaxAuthorityFeatures,
  type TaxAuthorityStatus,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!err?.message) return `Request failed: ${res.status}`;
  return Array.isArray(err.message) ? err.message.join(", ") : err.message;
}

/** Normalize older API responses that omit fake/real / allowed flags. */
export function normalizeTaxFeatures(raw: Partial<TaxAuthorityFeatures>): TaxAuthorityFeatures {
  let praFakeEnabled = Boolean(raw.praFakeEnabled);
  let praRealEnabled = Boolean(raw.praRealEnabled);
  const praEnabled = Boolean(raw.praEnabled) || praFakeEnabled || praRealEnabled;
  if (praEnabled && !praFakeEnabled && !praRealEnabled) {
    praRealEnabled = true;
  }
  if (praFakeEnabled && praRealEnabled) {
    praRealEnabled = false;
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
  const res = await authFetch("/v1/tax-authority/features");
  if (res.status === 404) {
    return {
      fbrAllowed: false,
      praFakeAllowed: false,
      praRealAllowed: false,
      fbrEnabled: false,
      praEnabled: false,
      praFakeEnabled: false,
      praRealEnabled: false,
    };
  }
  if (!res.ok) throw new Error(await readError(res));
  return normalizeTaxFeatures((await res.json()) as Partial<TaxAuthorityFeatures>);
}

export async function updateTaxFeaturesNormalized(patch: {
  fbrEnabled?: boolean;
  praEnabled?: boolean;
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): Promise<TaxAuthorityFeatures> {
  const res = await authFetch("/v1/tax-authority/features", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 404) {
    throw new Error(
      "PRA toggle API is not deployed on this server yet. Redeploy backend-desktop to enable it.",
    );
  }
  if (res.status === 403) {
    throw new Error((await readError(res)) || "Only Admin / Incharge can change PRA settings.");
  }
  if (!res.ok) throw new Error(await readError(res));
  return normalizeTaxFeatures((await res.json()) as Partial<TaxAuthorityFeatures>);
}

export async function fetchTaxAuthorityStatus(branchCode: string): Promise<TaxAuthorityStatus> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tax-authority/status?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return taxAuthorityStatusSchema.parse(await res.json());
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

export async function fetchPraDashboard(
  branchCode: string,
  mode: PraInvoiceMode = "real",
): Promise<PraDashboard> {
  const params = new URLSearchParams({ branchCode, mode });
  const res = await authFetch(`/v1/pra/dashboard?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return praDashboardSchema.parse(await res.json());
}

export async function fetchPraReports(input: {
  branchCode: string;
  mode?: PraInvoiceMode;
  period?: PraReportPeriod;
  from?: string;
  to?: string;
  status?: string;
}): Promise<PraReports> {
  const params = new URLSearchParams({ branchCode: input.branchCode });
  if (input.mode) params.set("mode", input.mode);
  if (input.period) params.set("period", input.period);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.status) params.set("status", input.status);
  const res = await authFetch(`/v1/pra/reports?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return praReportsSchema.parse(await res.json());
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

export function isPraNetworkFailureMessage(message: string): boolean {
  return /fetch failed|network timeout|could not reach|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|TLS|socket disconnected|PRA network error|secure TLS|Client network socket|whitelist|unreachable/i.test(
    message,
  );
}

/**
 * Post PRAL Live/PostData from this device (shop Wi‑Fi IP when possible).
 * React Native has no browser CORS — post directly to e-IMS.
 */
export async function postPraPayloadFromClient(input: {
  postUrl: string;
  bearerToken: string;
  payload: Record<string, unknown>;
}): Promise<{ invoiceNumber: string; raw: unknown }> {
  const body = JSON.stringify(input.payload);
  const res = await fetch(input.postUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.bearerToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = { message: text };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid Credentials — check Bearer Token / IP whitelist");
  }

  const code =
    typeof json === "object" && json && "Code" in json
      ? String((json as { Code: unknown }).Code)
      : "";
  const responseMsg =
    typeof json === "object" && json && "Response" in json
      ? String((json as { Response: unknown }).Response)
      : typeof json === "object" && json && "message" in json
        ? String((json as { message: unknown }).message)
        : text.slice(0, 200);

  if (res.status >= 200 && res.status < 300 && (!code || code === "100")) {
    const invoiceNumber =
      typeof json === "object" && json && "InvoiceNumber" in json
        ? String((json as { InvoiceNumber: unknown }).InvoiceNumber)
        : "";
    if (invoiceNumber && !/^not available$/i.test(invoiceNumber)) {
      return { invoiceNumber, raw: json };
    }
  }
  if (code && code !== "100") {
    throw new Error(responseMsg || `PRA rejected invoice (Code ${code})`);
  }
  throw new Error(
    responseMsg || `PRA client post failed (HTTP ${res.status}). Use shop Wi‑Fi if IP is whitelisted.`,
  );
}
