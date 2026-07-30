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
import { getApiBaseUrl } from "../lib/apiBase";
import { isLikelyNetworkFailure, mobileFetch } from "../lib/mobileFetch";

/** Warm TLS / DNS before a write so slow mobile links fail less often on POST. */
async function wakeApi(): Promise<void> {
  try {
    await mobileFetch(`${getApiBaseUrl()}/health`, { method: "GET" });
  } catch {
    // best-effort — create still runs
  }
}

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

/**
 * If the POST timed out but the server actually saved the ticket, recover it
 * by orderRef instead of inserting a duplicate.
 */
async function findActiveTicketByOrderRef(
  branchCode: string,
  orderRef: string | undefined,
): Promise<KitchenTicket | null> {
  const ref = orderRef?.trim();
  if (!ref) return null;
  try {
    const tickets = await fetchKitchenTickets(branchCode);
    return tickets.find((t) => t.orderRef === ref && t.status !== "done") ?? null;
  } catch {
    return null;
  }
}

export async function createKitchenTicket(input: CreateKitchenTicket): Promise<KitchenTicket> {
  const body = createKitchenTicketSchema.parse(input);
  await wakeApi();

  try {
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
  } catch (err) {
    if (!isLikelyNetworkFailure(err)) throw err;
    // POST may have succeeded on Railway while the phone lost the response.
    const recovered = await findActiveTicketByOrderRef(body.branchCode, body.orderRef);
    if (recovered) return recovered;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await wakeApi();
    const res = await authFetch("/v1/kitchen/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Second attempt failed — check again in case the first POST landed late.
      const late = await findActiveTicketByOrderRef(body.branchCode, body.orderRef);
      if (late) return late;
      const apiErr = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(apiErr?.message ?? `Create order failed: ${res.status}`);
    }
    return kitchenTicketSchema.parse(await res.json());
  }
}

export async function updateKitchenTicket(
  ticketId: string,
  input: UpdateKitchenTicket,
): Promise<KitchenTicket> {
  const body = updateKitchenTicketSchema.parse(input);
  await wakeApi();
  try {
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
  } catch (err) {
    if (!isLikelyNetworkFailure(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await wakeApi();
    const res = await authFetch(`/v1/kitchen/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const apiErr = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(apiErr?.message ?? `Update order failed: ${res.status}`);
    }
    return kitchenTicketSchema.parse(await res.json());
  }
}
