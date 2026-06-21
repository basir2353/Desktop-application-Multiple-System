import {
  createKitchenTicketSchema,
  kitchenTicketListSchema,
  kitchenTicketSchema,
  updateKitchenTicketSchema,
  type CreateKitchenTicket,
  type KitchenTicket,
  type UpdateKitchenTicket,
} from "@platform/contracts";
import { authFetch } from "../lib/authFetch";

export async function fetchKitchenTickets(branchCode: string): Promise<KitchenTicket[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/kitchen/tickets?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Kitchen tickets failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return kitchenTicketListSchema.parse(json).tickets;
}

export async function createKitchenTicket(input: CreateKitchenTicket): Promise<KitchenTicket> {
  const body = createKitchenTicketSchema.parse(input);
  const res = await authFetch("/v1/kitchen/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create order failed: ${res.status}`);
  }
  return kitchenTicketSchema.parse(await res.json());
}

export async function updateKitchenTicket(
  ticketId: string,
  input: UpdateKitchenTicket,
): Promise<KitchenTicket> {
  const body = updateKitchenTicketSchema.parse(input);
  const res = await authFetch(`/v1/kitchen/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update order failed: ${res.status}`);
  }
  return kitchenTicketSchema.parse(await res.json());
}
