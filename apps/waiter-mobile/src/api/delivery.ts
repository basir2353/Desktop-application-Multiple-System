import {
  deliveryOrderListSchema,
  deliveryOrderSchema,
  riderDeliveryStatusUpdateSchema,
  type DeliveryOrder,
  type RiderDeliveryStatusUpdate,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchMyDeliveries(branchCode: string): Promise<DeliveryOrder[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/delivery/my-orders?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Deliveries failed: ${res.status}`);
  }
  return deliveryOrderListSchema.parse(await res.json()).orders;
}

export async function updateDeliveryStatus(
  ticketId: string,
  input: RiderDeliveryStatusUpdate,
): Promise<DeliveryOrder> {
  const body = riderDeliveryStatusUpdateSchema.parse(input);
  const res = await authFetch(`/v1/delivery/my-orders/${ticketId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update delivery failed: ${res.status}`);
  }
  return deliveryOrderSchema.parse(await res.json());
}
