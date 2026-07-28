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

async function withNetworkRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isLikelyNetworkFailure(err) || attempt + 1 >= attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
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

export async function createKitchenTicket(input: CreateKitchenTicket): Promise<KitchenTicket> {
  const body = createKitchenTicketSchema.parse(input);
  await wakeApi();
  // Safe to retry: API returns the existing active ticket for the same orderRef.
  return withNetworkRetry(async () => {
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
  });
}

export async function updateKitchenTicket(
  ticketId: string,
  input: UpdateKitchenTicket,
): Promise<KitchenTicket> {
  const body = updateKitchenTicketSchema.parse(input);
  await wakeApi();
  return withNetworkRetry(async () => {
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
  });
}
