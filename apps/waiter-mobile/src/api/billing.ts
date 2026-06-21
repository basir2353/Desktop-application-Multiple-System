import {
  billSchema,
  createBillSchema,
  orderListSchema,
  updateBillSchema,
  type Bill,
  type CreateBill,
  type UpdateBill,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchOrders(branchCode: string): Promise<Bill[]> {
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
