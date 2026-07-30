/** API helpers for Fake / Real PRA fiscal invoices. */

import {
  issuePraInvoiceResultSchema,
  praFiscalInvoiceSchema,
  type IssuePraInvoiceInput,
  type IssuePraInvoiceResult,
  type PraFiscalInvoice,
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

/** Normalize older API responses that omit fake/real flags. */
export function normalizeTaxFeatures(raw: TaxAuthorityFeatures): TaxAuthorityFeatures {
  let praFakeEnabled = Boolean(raw.praFakeEnabled);
  let praRealEnabled = Boolean(raw.praRealEnabled);
  const praEnabled = Boolean(raw.praEnabled) || praFakeEnabled || praRealEnabled;
  // Legacy: praEnabled alone → treat as Real PRA.
  if (praEnabled && !praFakeEnabled && !praRealEnabled) {
    return {
      fbrEnabled: Boolean(raw.fbrEnabled),
      praEnabled: true,
      praFakeEnabled: false,
      praRealEnabled: true,
    };
  }
  // Prefer Real when corrupt (both true).
  if (praFakeEnabled && praRealEnabled) {
    praFakeEnabled = false;
  }
  return {
    fbrEnabled: Boolean(raw.fbrEnabled),
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
