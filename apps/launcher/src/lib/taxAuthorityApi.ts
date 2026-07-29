import {
  fbrConnectSchema,
  praConnectSchema,
  taxAuthorityFeaturesSchema,
  taxAuthorityStatusSchema,
  taxConnectResultSchema,
  taxInvoiceSchema,
  type FbrConnectInput,
  type PraConnectInput,
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
    return { fbrEnabled: false, praEnabled: false };
  }
  if (!res.ok) throw new Error(await readError(res));
  return taxAuthorityFeaturesSchema.parse(await res.json());
}

/** Org Admin / Incharge: enable or disable FBR and/or PRA for this business. */
export async function updateTaxAuthorityFeatures(patch: {
  fbrEnabled?: boolean;
  praEnabled?: boolean;
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
  return taxAuthorityFeaturesSchema.parse(await res.json());
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

export async function fetchTaxInvoices(branchCode: string): Promise<TaxInvoice[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tax-authority/invoices?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid invoices response");
  return json.map((row) => taxInvoiceSchema.parse(row));
}
