import { authFetch } from "../lib/authFetch";

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? fallback);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? fallback);
  }
  return (await res.json()) as T;
}

export type TfCustomer = { id: string; name: string; isCash: boolean; closingBalancePkr: number };
export type TfSupplier = { id: string; name: string; closingBalancePkr: number };
export type TfItem = { id: string; name: string; unit: string; altUnit: string; defaultRatePkr: number; onHandQty: number; onHandAlt: number };
export type TfDashboard = {
  todaySalesPkr: number;
  todayExpensesPkr: number;
  todayProfitPkr: number;
  todayReceiptsPkr: number;
  todayPurchasesPkr: number;
  todayReturnsPkr: number;
};

export function fetchTfDashboard(branchCode: string) {
  return getJson<TfDashboard>(`/v1/tradeflow/dashboard?branchCode=${encodeURIComponent(branchCode)}`, "Could not load dashboard");
}
export function fetchTfCustomers(branchCode: string) {
  return getJson<TfCustomer[]>(`/v1/tradeflow/customers?branchCode=${encodeURIComponent(branchCode)}`, "Could not load customers");
}
export function fetchTfSuppliers(branchCode: string) {
  return getJson<TfSupplier[]>(`/v1/tradeflow/suppliers?branchCode=${encodeURIComponent(branchCode)}`, "Could not load suppliers");
}
export function fetchTfItems(branchCode: string) {
  return getJson<TfItem[]>(`/v1/tradeflow/items?branchCode=${encodeURIComponent(branchCode)}`, "Could not load items");
}
export function createTfInvoice(body: unknown) {
  return postJson("/v1/tradeflow/invoices", body, "Could not save sale");
}
export function createTfPurchase(body: unknown) {
  return postJson("/v1/tradeflow/purchases", body, "Could not save purchase");
}
export function createTfPayment(body: unknown) {
  return postJson("/v1/tradeflow/payments", body, "Could not save payment");
}
export function createTfExpense(body: unknown) {
  return postJson("/v1/tradeflow/expenses", body, "Could not save expense");
}
export function createTfReturn(body: unknown) {
  return postJson("/v1/tradeflow/returns", body, "Could not save return");
}
