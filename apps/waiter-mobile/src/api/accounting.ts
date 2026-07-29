import {
  cashSessionLiveSchema,
  cashSessionSchema,
  createPopsCashMovementSchema,
  customerInvoiceSchema,
  expenseSchema,
  openCashSessionSchema,
  popsCashMovementSchema,
  vendorBillSchema,
  type CashSession,
  type CashSessionLive,
  type CreatePopsCashMovement,
  type CustomerInvoice,
  type Expense,
  type OpenCashSession,
  type PopsCashMovement,
  type VendorBill,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

function branchParams(branchCode: string): URLSearchParams {
  return new URLSearchParams({ branchCode });
}

export async function fetchAccountingDashboard(branchCode: string) {
  const { accountingDashboardSchema } = await import("@platform/contracts");
  const res = await authFetch(`/v1/accounting/dashboard?${branchParams(branchCode)}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Accounting dashboard failed: ${res.status}`);
  }
  return accountingDashboardSchema.parse(await res.json());
}

export async function fetchExpenses(branchCode: string): Promise<Expense[]> {
  const res = await authFetch(`/v1/accounting/expenses?${branchParams(branchCode)}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Expenses failed: ${res.status}`);
  }
  return expenseSchema.array().parse(await res.json());
}

export async function fetchVendorBills(branchCode: string): Promise<VendorBill[]> {
  const res = await authFetch(`/v1/accounting/payable?${branchParams(branchCode)}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Vendor bills failed: ${res.status}`);
  }
  return vendorBillSchema.array().parse(await res.json());
}

export async function fetchCustomerInvoices(branchCode: string): Promise<CustomerInvoice[]> {
  const res = await authFetch(`/v1/accounting/receivable?${branchParams(branchCode)}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Receivables failed: ${res.status}`);
  }
  return customerInvoiceSchema.array().parse(await res.json());
}

export async function fetchOpenCashSession(branchCode: string): Promise<CashSessionLive | null> {
  const res = await authFetch(`/v1/accounting/cash-sessions/open?${branchParams(branchCode)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Open cash session failed: ${res.status}`);
  }
  return cashSessionLiveSchema.parse(await res.json());
}

export async function openCashSession(input: OpenCashSession): Promise<CashSession> {
  const body = openCashSessionSchema.parse(input);
  const res = await authFetch("/v1/accounting/cash-sessions/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Open cash session failed: ${res.status}`);
  }
  return cashSessionSchema.parse(await res.json());
}

export async function recordCashMovement(input: CreatePopsCashMovement): Promise<PopsCashMovement> {
  const body = createPopsCashMovementSchema.parse({
    ...input,
    clientRequestId:
      input.clientRequestId ?? `mob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const res = await authFetch("/v1/accounting/cash-movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Pay out failed: ${res.status}`);
  }
  return popsCashMovementSchema.parse(await res.json());
}
