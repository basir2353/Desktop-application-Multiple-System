import {
  createKitchenTicketSchema,
  kitchenTicketListSchema,
  kitchenTicketSchema,
  updateKitchenTicketSchema,
  type CreateKitchenTicket,
  type KitchenTicket,
  type UpdateKitchenTicket,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";
import {
  enqueueOfflineKot,
  isOnline,
  isTransientOrderError,
  loadOfflineKots,
  markOrdersForceOpen,
} from "../lib/popsOfflineOrders";
import { resumeOrders } from "./closing";

async function createKitchenTicketRemote(input: CreateKitchenTicket): Promise<KitchenTicket> {
  const body = createKitchenTicketSchema.parse(input);
  const res = await authFetch("/v1/kitchen/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create KOT failed: ${res.status}`);
  }
  return kitchenTicketSchema.parse(await res.json());
}

export async function fetchKitchenTickets(branchCode: string): Promise<KitchenTicket[]> {
  const offline = loadOfflineKots();
  try {
    const params = new URLSearchParams({ branchCode });
    const res = await authFetch(`/v1/kitchen/tickets?${params}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(err?.message ?? `Kitchen tickets failed: ${res.status}`);
    }
    const json: unknown = await res.json();
    const remote = kitchenTicketListSchema.parse(json).tickets;
    const remoteIds = new Set(remote.map((t) => t.id));
    return [...offline.filter((t) => !remoteIds.has(t.id)), ...remote];
  } catch {
    return offline;
  }
}

export async function createKitchenTicketRemoteOnly(
  input: CreateKitchenTicket,
): Promise<KitchenTicket> {
  return createKitchenTicketRemote(createKitchenTicketSchema.parse(input));
}

export async function createKitchenTicket(input: CreateKitchenTicket): Promise<KitchenTicket> {
  const body = createKitchenTicketSchema.parse(input);

  if (!isOnline()) {
    return enqueueOfflineKot(body);
  }

  try {
    return await createKitchenTicketRemote(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isTransientOrderError(message)) throw err;

    markOrdersForceOpen();
    try {
      await resumeOrders(body.branchCode);
      return await createKitchenTicketRemote(body);
    } catch {
      return enqueueOfflineKot(body);
    }
  }
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
    throw new Error(err?.message ?? `Update KOT failed: ${res.status}`);
  }
  return kitchenTicketSchema.parse(await res.json());
}

export async function bumpKitchenPriority(branchCode: string): Promise<void> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/kitchen/tickets/bump-priority?${params}`, { method: "POST" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Bump priority failed: ${res.status}`);
  }
}
