import {
  fbrConnectSchema,
  praConnectSchema,
  taxAuthorityStatusSchema,
  taxConnectResultSchema,
  taxInvoiceSchema,
  type FbrConnectInput,
  type PraConnectInput,
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
