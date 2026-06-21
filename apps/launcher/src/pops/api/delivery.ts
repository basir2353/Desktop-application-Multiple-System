import {
  createRiderSchema,
  riderListSchema,
  riderSchema,
  updateDeliveryOrderSchema,
  updateRiderSchema,
  type CreateRider,
  type Rider,
  type UpdateDeliveryOrder,
  type UpdateRider,
} from "@platform/contracts";
import { kitchenTicketSchema, type KitchenTicket } from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchRiders(branchCode: string): Promise<Rider[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/delivery/riders?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Riders failed: ${res.status}`);
  }
  return riderListSchema.parse(await res.json()).riders;
}

export async function createRider(input: CreateRider): Promise<Rider> {
  const body = createRiderSchema.parse(input);
  const res = await authFetch("/v1/delivery/riders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create rider failed: ${res.status}`);
  }
  return riderSchema.parse(await res.json());
}

export async function updateRider(riderId: string, input: UpdateRider): Promise<Rider> {
  const body = updateRiderSchema.parse(input);
  const res = await authFetch(`/v1/delivery/riders/${riderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update rider failed: ${res.status}`);
  }
  return riderSchema.parse(await res.json());
}

export async function updateDeliveryOrder(
  ticketId: string,
  input: UpdateDeliveryOrder,
): Promise<KitchenTicket> {
  const body = updateDeliveryOrderSchema.parse(input);
  const res = await authFetch(`/v1/delivery/orders/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update delivery order failed: ${res.status}`);
  }
  return kitchenTicketSchema.parse(await res.json());
}
