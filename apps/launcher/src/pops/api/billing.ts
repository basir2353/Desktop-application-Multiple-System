import {
  billSchema,
  completeBillSchema,
  createBillSchema,
  createWaiterSchema,
  orderListSchema,
  updateBillSchema,
  updateWaiterSchema,
  waiterOptionSchema,
  type Bill,
  type CompleteBill,
  type CreateBill,
  type CreateWaiter,
  type UpdateBill,
  type UpdateWaiter,
  type WaiterOption,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchWaiters(branchCode?: string): Promise<WaiterOption[]> {
  const params = branchCode ? `?${new URLSearchParams({ branchCode })}` : "";
  const res = await authFetch(`/v1/billing/waiters${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Waiters failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid waiters response");
  return json.map((row) => waiterOptionSchema.parse(row));
}

export async function createWaiter(input: CreateWaiter): Promise<WaiterOption> {
  const body = createWaiterSchema.parse(input);
  const res = await authFetch("/v1/billing/waiters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create waiter failed: ${res.status}`);
  }
  return waiterOptionSchema.parse(await res.json());
}

export async function updateWaiter(waiterId: string, input: UpdateWaiter): Promise<WaiterOption> {
  const body = updateWaiterSchema.parse(input);
  const res = await authFetch(`/v1/billing/waiters/${waiterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update waiter failed: ${res.status}`);
  }
  return waiterOptionSchema.parse(await res.json());
}

export async function fetchCompletedOrders(branchCode: string): Promise<Bill[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/billing/orders?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Orders failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return orderListSchema.parse(json).orders;
}

export async function createBill(input: CreateBill): Promise<Bill> {
  const body = createBillSchema.parse(input);
  const res = await authFetch("/v1/billing/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create bill failed: ${res.status}`);
  }
  return billSchema.parse(await res.json());
}

export async function completeBill(billId: string, input: CompleteBill): Promise<Bill> {
  const body = completeBillSchema.parse(input);
  const res = await authFetch(`/v1/billing/bills/${billId}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Complete bill failed: ${res.status}`);
  }
  return billSchema.parse(await res.json());
}

export async function updateBill(billId: string, input: UpdateBill): Promise<Bill> {
  const body = updateBillSchema.parse(input);
  const res = await authFetch(`/v1/billing/bills/${billId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update bill failed: ${res.status}`);
  }
  return billSchema.parse(await res.json());
}

export async function voidBill(billId: string): Promise<Bill> {
  const res = await authFetch(`/v1/billing/bills/${billId}/void`, { method: "PATCH" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Void bill failed: ${res.status}`);
  }
  return billSchema.parse(await res.json());
}

export async function deleteBill(billId: string): Promise<{ ok: true; billRef: string }> {
  const res = await authFetch(`/v1/billing/bills/${billId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Delete bill failed: ${res.status}`);
  }
  return (await res.json()) as { ok: true; billRef: string };
}
