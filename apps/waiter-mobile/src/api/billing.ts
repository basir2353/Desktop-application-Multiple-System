import {
  billSchema,
  completeBillSchema,
  createBillSchema,
  orderListSchema,
  updateBillSchema,
  type Bill,
  type CompleteBill,
  type CreateBill,
  type UpdateBill,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";
import { getApiBaseUrl } from "../lib/apiBase";
import { isLikelyNetworkFailure, mobileFetch } from "../lib/mobileFetch";

async function wakeApi(): Promise<void> {
  try {
    await mobileFetch(`${getApiBaseUrl()}/health`, { method: "GET" });
  } catch {
    // best-effort
  }
}

async function findHeldBillByOrderRef(
  branchCode: string,
  orderRef: string | undefined,
): Promise<Bill | null> {
  const ref = orderRef?.trim();
  if (!ref) return null;
  try {
    const orders = await fetchOrders(branchCode);
    return (
      orders.find(
        (b) => b.orderRef === ref && (b.status === "held" || b.status === "open"),
      ) ?? null
    );
  } catch {
    return null;
  }
}

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
  await wakeApi();

  try {
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
  } catch (err) {
    if (!isLikelyNetworkFailure(err)) throw err;
    const recovered = await findHeldBillByOrderRef(body.branchCode, body.orderRef);
    if (recovered) return recovered;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await wakeApi();
    const res = await authFetch("/v1/billing/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const late = await findHeldBillByOrderRef(body.branchCode, body.orderRef);
      if (late) return late;
      const apiErr = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(apiErr?.message ?? `Create bill failed: ${res.status}`);
    }
    return billSchema.parse(await res.json());
  }
}

export async function updateBill(billId: string, input: UpdateBill): Promise<Bill> {
  const body = updateBillSchema.parse(input);
  await wakeApi();
  try {
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
  } catch (err) {
    if (!isLikelyNetworkFailure(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await wakeApi();
    const res = await authFetch(`/v1/billing/bills/${billId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const apiErr = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(apiErr?.message ?? `Update bill failed: ${res.status}`);
    }
    return billSchema.parse(await res.json());
  }
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
