import {
  fbrConnectSchema,
  praConnectSchema,
  praDashboardSchema,
  praReportsSchema,
  retryFailedTaxInvoicesResultSchema,
  taxActivityLogSchema,
  taxAuthorityFeaturesSchema,
  taxAuthorityStatusSchema,
  taxConnectResultSchema,
  taxInvoiceSchema,
  updatePraIntegrationSettingsSchema,
  type FbrConnectInput,
  type PraConnectInput,
  type PraDashboard,
  type PraIntegrationSettings,
  type PraInvoiceMode,
  type PraReportPeriod,
  type PraReports,
  type TaxActivityLog,
  type TaxAuthorityFeatures,
  type TaxAuthorityStatus,
  type TaxConnectResult,
  type TaxInvoice,
} from "@platform/contracts";
import { authFetch } from "./authFetch";

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!err?.message) return `Request failed: ${res.status}`;
  return Array.isArray(err.message) ? err.message.join(", ") : err.message;
}

export async function fetchTaxAuthorityFeatures(): Promise<TaxAuthorityFeatures> {
  const res = await authFetch("/v1/tax-authority/features");
  // Older hosted APIs omit this route — treat as not enabled (Super Admin must grant).
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
  const raw = await res.json();
  return taxAuthorityFeaturesSchema.parse({
    fbrAllowed: Boolean(raw?.fbrAllowed) || Boolean(raw?.fbrEnabled),
    praFakeAllowed: Boolean(raw?.praFakeAllowed) || Boolean(raw?.praFakeEnabled),
    praRealAllowed: Boolean(raw?.praRealAllowed) || Boolean(raw?.praRealEnabled),
    fbrEnabled: Boolean(raw?.fbrEnabled),
    praEnabled: Boolean(raw?.praEnabled),
    praFakeEnabled: Boolean(raw?.praFakeEnabled),
    praRealEnabled: Boolean(raw?.praRealEnabled),
  });
}

/** Org Admin / Incharge: Active / Inactive for FBR and/or PRA (section must be Allowed). */
export async function updateTaxAuthorityFeatures(patch: {
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
    throw new Error("Tax feature updates require a Super Admin grant on a current API.");
  }
  if (!res.ok) throw new Error(await readError(res));
  const raw = await res.json();
  return taxAuthorityFeaturesSchema.parse({
    fbrAllowed: Boolean(raw?.fbrAllowed) || Boolean(raw?.fbrEnabled),
    praFakeAllowed: Boolean(raw?.praFakeAllowed) || Boolean(raw?.praFakeEnabled),
    praRealAllowed: Boolean(raw?.praRealAllowed) || Boolean(raw?.praRealEnabled),
    fbrEnabled: Boolean(raw?.fbrEnabled),
    praEnabled: Boolean(raw?.praEnabled),
    praFakeEnabled: Boolean(raw?.praFakeEnabled),
    praRealEnabled: Boolean(raw?.praRealEnabled),
  });
}

export async function fetchTaxAuthorityStatus(branchCode: string): Promise<TaxAuthorityStatus> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tax-authority/status?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return taxAuthorityStatusSchema.parse(await res.json());
}

export async function connectFbr(input: FbrConnectInput): Promise<TaxConnectResult> {
  const body = fbrConnectSchema.parse(input);
  const res = await authFetch("/v1/fbr/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function connectPra(input: PraConnectInput): Promise<TaxConnectResult> {
  const body = praConnectSchema.parse(input);
  const res = await authFetch("/v1/pra/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function testPraConnection(input: PraConnectInput): Promise<TaxConnectResult> {
  const body = praConnectSchema.parse(input);
  const res = await authFetch("/v1/pra/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function preparePraClientTest(branchCode: string): Promise<{
  postUrl: string;
  bearerToken: string;
  payload: Record<string, unknown>;
  message: string;
}> {
  const res = await authFetch("/v1/pra/prepare-client-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    postUrl: string;
    bearerToken: string;
    payload: Record<string, unknown>;
    message: string;
  };
}

export async function disconnectPra(branchCode: string): Promise<TaxConnectResult> {
  const res = await authFetch("/v1/pra/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function updatePraSettings(
  input: Partial<PraIntegrationSettings> & { branchCode: string },
): Promise<PraIntegrationSettings> {
  const body = updatePraIntegrationSettingsSchema.parse(input);
  const res = await authFetch("/v1/pra/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const raw = await res.json();
  return {
    autoSubmit: Boolean(raw?.autoSubmit),
    offlineQueue: Boolean(raw?.offlineQueue),
    retryFailed: Boolean(raw?.retryFailed),
    maxRetryAttempts: Number(raw?.maxRetryAttempts ?? 3),
  };
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
  mode: PraInvoiceMode;
  period: PraReportPeriod;
  from?: string;
  to?: string;
  status?: string;
}): Promise<PraReports> {
  const params = new URLSearchParams({
    branchCode: input.branchCode,
    mode: input.mode,
    period: input.period,
  });
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.status && input.status !== "all") params.set("status", input.status);
  const res = await authFetch(`/v1/pra/reports?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return praReportsSchema.parse(await res.json());
}

export async function fetchPraActivityLogs(
  branchCode: string,
  limit = 50,
): Promise<TaxActivityLog[]> {
  const params = new URLSearchParams({ branchCode, limit: String(limit) });
  const res = await authFetch(`/v1/pra/activity-logs?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid activity logs response");
  return json.map((row) => taxActivityLogSchema.parse(row));
}

export async function retryFailedPraInvoices(branchCode: string) {
  const res = await authFetch("/v1/pra/retry-failed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode, authority: "pra" }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return retryFailedTaxInvoicesResultSchema.parse(await res.json());
}

export async function refreshFbrToken(branchCode: string): Promise<TaxConnectResult> {
  const res = await authFetch("/v1/fbr/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function refreshPraToken(branchCode: string): Promise<TaxConnectResult> {
  const res = await authFetch("/v1/pra/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return taxConnectResultSchema.parse(await res.json());
}

export async function fetchTaxInvoices(
  branchCode: string,
  filters?: {
    invoiceMode?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
): Promise<TaxInvoice[]> {
  const params = new URLSearchParams({ branchCode });
  if (filters?.invoiceMode) params.set("invoiceMode", filters.invoiceMode);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const res = await authFetch(`/v1/tax-authority/invoices?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid invoices response");
  return json.map((row) => taxInvoiceSchema.parse(row));
}
