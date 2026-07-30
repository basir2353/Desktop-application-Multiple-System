import {
  issuePraInvoiceResultSchema,
  praFiscalInvoiceSchema,
  type IssuePraInvoiceInput,
  type IssuePraInvoiceResult,
  type PraFiscalInvoice,
  type TaxAuthorityFeatures,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!err?.message) return `Request failed: ${res.status}`;
  return Array.isArray(err.message) ? err.message.join(", ") : err.message;
}

/** Normalize older API responses that omit fake/real flags. */
export function normalizeTaxFeatures(raw: Partial<TaxAuthorityFeatures>): TaxAuthorityFeatures {
  let praFakeEnabled = Boolean(raw.praFakeEnabled);
  let praRealEnabled = Boolean(raw.praRealEnabled);
  const praEnabled = Boolean(raw.praEnabled) || praFakeEnabled || praRealEnabled;
  if (praEnabled && !praFakeEnabled && !praRealEnabled) {
    return {
      fbrEnabled: Boolean(raw.fbrEnabled),
      praEnabled: true,
      praFakeEnabled: false,
      praRealEnabled: true,
    };
  }
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
  const res = await authFetch("/v1/tax-authority/features");
  if (res.status === 404) {
    return {
      fbrEnabled: false,
      praEnabled: false,
      praFakeEnabled: false,
      praRealEnabled: false,
    };
  }
  if (!res.ok) throw new Error(await readError(res));
  return normalizeTaxFeatures((await res.json()) as Partial<TaxAuthorityFeatures>);
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
