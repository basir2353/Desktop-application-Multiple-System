import { accountingDashboardSchema, type AccountingDashboard } from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchAccountingDashboard(branchCode: string): Promise<AccountingDashboard> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/accounting/dashboard?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Accounting dashboard failed: ${res.status}`);
  }
  return accountingDashboardSchema.parse(await res.json());
}
