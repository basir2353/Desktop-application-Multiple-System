import {
  branchTransferSchema,
  consolidatedReportSchema,
  copyBranchPricingSchema,
  createBranchTransferSchema,
  manualBranchReceiveSchema,
  multiBranchOverviewSchema,
  setBranchPriceOverrideSchema,
  updateBranchTransferSchema,
  type BranchTransfer,
  type ConsolidatedReport,
  type CopyBranchPricing,
  type CreateBranchTransfer,
  type ManualBranchReceive,
  type MultiBranchOverview,
  type SetBranchPriceOverride,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchMultiBranchOverview(): Promise<MultiBranchOverview> {
  const res = await authFetch("/v1/multi-branch/overview");
  if (!res.ok) throw new Error(await readError(res));
  return multiBranchOverviewSchema.parse(await res.json());
}

export async function fetchConsolidatedReport(): Promise<ConsolidatedReport> {
  const res = await authFetch("/v1/multi-branch/report");
  if (!res.ok) throw new Error(await readError(res));
  return consolidatedReportSchema.parse(await res.json());
}

export async function fetchBranchTransfers(): Promise<BranchTransfer[]> {
  const res = await authFetch("/v1/multi-branch/transfers");
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { transfers: unknown[] };
  return branchTransferSchema.array().parse(json.transfers);
}

export async function fetchTransferIngredients(branchCode: string) {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/multi-branch/transfers/ingredients?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    branchCode: string;
    ingredients: { id: string; sku: string; name: string; unit: string; currentStock: number }[];
  };
}

export async function createBranchTransfer(input: CreateBranchTransfer) {
  const body = createBranchTransferSchema.parse(input);
  const res = await authFetch("/v1/multi-branch/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return branchTransferSchema.parse(await res.json());
}

export async function createManualBranchReceive(input: ManualBranchReceive) {
  const body = manualBranchReceiveSchema.parse(input);
  const res = await authFetch("/v1/multi-branch/transfers/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return branchTransferSchema.parse(await res.json());
}

export async function updateBranchTransfer(
  transferId: string,
  status: "dispatched" | "received" | "cancelled",
) {
  const body = updateBranchTransferSchema.parse({ status });
  const res = await authFetch(`/v1/multi-branch/transfers/${transferId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return branchTransferSchema.parse(await res.json());
}

export async function fetchBranchPricing(branchCode?: string) {
  const params = branchCode ? new URLSearchParams({ branchCode }) : "";
  const res = await authFetch(`/v1/multi-branch/pricing${params ? `?${params}` : ""}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { rows: unknown[] };
}

export async function setBranchPriceOverride(input: SetBranchPriceOverride) {
  const body = setBranchPriceOverrideSchema.parse(input);
  const res = await authFetch("/v1/multi-branch/pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function copyBranchPricing(input: CopyBranchPricing) {
  const body = copyBranchPricingSchema.parse(input);
  const res = await authFetch("/v1/multi-branch/pricing/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ copied: number; fromBranch: string; toBranch: string }>;
}

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  return err?.message ?? `Request failed: ${res.status}`;
}
