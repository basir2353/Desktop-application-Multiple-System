import {
  createKitchenTicketSchema,
  kitchenLineCancellationListSchema,
  kitchenTicketListSchema,
  kitchenTicketSchema,
  updateKitchenTicketSchema,
  type CreateKitchenTicket,
  type KitchenLineCancellationList,
  type KitchenTicket,
  type UpdateKitchenTicket,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";
import {
  enqueueOfflineKot,
  isOnline,
  isTransientOrderError,
  loadOfflineKotEntries,
  loadOfflineKots,
  markOrdersForceOpen,
  removeOfflineKot,
} from "../lib/popsOfflineOrders";
import { resumeOrders } from "./closing";

function isKitchenTicketNotFoundMessage(message: string): boolean {
  return /kitchen ticket not found/i.test(message) || message === "KITCHEN_TICKET_NOT_FOUND";
}

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

function softParseKitchenTickets(json: unknown): KitchenTicket[] {
  const listParsed = kitchenTicketListSchema.safeParse(json);
  if (listParsed.success) return listParsed.data.tickets;
  if (json && typeof json === "object" && Array.isArray((json as { tickets?: unknown }).tickets)) {
    const out: KitchenTicket[] = [];
    for (const row of (json as { tickets: unknown[] }).tickets) {
      const one = kitchenTicketSchema.safeParse(row);
      if (one.success) out.push(one.data);
    }
    return out;
  }
  throw new Error("Kitchen tickets response invalid");
}

function softParseKitchenTicket(json: unknown): KitchenTicket {
  const parsed = kitchenTicketSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    // Last-resort: keep Complete/Accept working even if one nested field drifts.
    const fallback = kitchenTicketSchema.safeParse({
      ...obj,
      lines: Array.isArray(obj.lines)
        ? (obj.lines as unknown[]).map((line) => {
            if (!line || typeof line !== "object") return line;
            const l = line as Record<string, unknown>;
            return {
              ...l,
              qty: Math.max(1, Math.round(Number(l.qty) || 1)),
              unitPrice: Number(l.unitPrice) || 0,
              menuItemId:
                typeof l.menuItemId === "string" && l.menuItemId.trim()
                  ? l.menuItemId.trim()
                  : undefined,
            };
          })
        : undefined,
      mins: Math.max(0, Math.floor(Number(obj.mins) || 0)),
      deliveryChargePkr: Number(obj.deliveryChargePkr) || 0,
    });
    if (fallback.success) return fallback.data;
  }
  throw new Error("Kitchen ticket response invalid");
}

export type KitchenTicketScope = "active" | "done" | "all" | "pos-open";

export async function fetchKitchenTickets(
  branchCode: string,
  opts?: { scope?: KitchenTicketScope },
): Promise<KitchenTicket[]> {
  const offline = loadOfflineKots();
  try {
    const params = new URLSearchParams({ branchCode });
    if (opts?.scope) params.set("scope", opts.scope);
    const res = await authFetch(`/v1/kitchen/tickets?${params}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(err?.message ?? `Kitchen tickets failed: ${res.status}`);
    }
    const json: unknown = await res.json();
    let remote = softParseKitchenTickets(json);
    if (opts?.scope === "done") {
      return remote.filter((t) => t.status === "done");
    }
    // active (default): hide done. all / pos-open: keep done tickets from the API.
    if (opts?.scope !== "all" && opts?.scope !== "pos-open") {
      remote = remote.filter((t) => t.status !== "done");
    }
    const remoteIds = new Set(remote.map((t) => t.id));
    // Offline KOTs that were already completed on the server must not stick on Active.
    const offlineOpen = offline.filter(
      (t) => t.status !== "done" && !remoteIds.has(t.id),
    );
    return [...offlineOpen, ...remote];
  } catch (err) {
    if (opts?.scope === "done") return [];
    // Offline-only fallback when the device is offline; otherwise surface the error
    // so the kitchen board does not look "alive" on a stale local list.
    if (!isOnline()) return offline.filter((t) => t.status !== "done");
    throw err instanceof Error ? err : new Error("Kitchen tickets failed");
  }
}

export async function fetchCompletedKitchenTickets(branchCode: string): Promise<KitchenTicket[]> {
  return fetchKitchenTickets(branchCode, { scope: "done" });
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

  // Offline / local-only tickets are not on the server — update locally or promote.
  const offline = loadOfflineKotEntries().find(
    (entry) => entry.id === ticketId || entry.materialised.id === ticketId,
  );
  if (offline) {
    if (body.status === "done") {
      removeOfflineKot(offline.id);
      return {
        ...offline.materialised,
        status: "done",
        stationLabel: body.stationLabel?.trim() || offline.materialised.stationLabel,
        notes:
          body.notes !== undefined ? body.notes : offline.materialised.notes,
      };
    }

    const merged: CreateKitchenTicket = {
      ...offline.payload,
      ...(body.stationLabel !== undefined ? { stationLabel: body.stationLabel } : {}),
      ...(body.lines !== undefined ? { lines: body.lines } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.riderId !== undefined ? { riderId: body.riderId } : {}),
      ...(body.deliveryChargePkr !== undefined
        ? { deliveryChargePkr: body.deliveryChargePkr }
        : {}),
      ...(body.deliveryStatus !== undefined ? { deliveryStatus: body.deliveryStatus } : {}),
    };
    removeOfflineKot(offline.id);

    // Prefer pushing to the live API so Print / Update works after day-close recovery.
    try {
      return await createKitchenTicket(merged);
    } catch {
      const again = enqueueOfflineKot(merged);
      return again;
    }
  }

  const res = await authFetch(`/v1/kitchen/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Read body once — never call res.json() twice on the same Response.
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = payload as { message?: string } | null;
    const message = err?.message ?? `Update KOT failed: ${res.status}`;
    if (res.status === 404 || isKitchenTicketNotFoundMessage(message)) {
      throw new Error("KITCHEN_TICKET_NOT_FOUND");
    }
    throw new Error(message);
  }
  // Soft-parse so Complete/Accept still moves the ticket if one nested field is odd.
  return softParseKitchenTicket(payload);
}

/** True when update/create should recreate because the ticket no longer exists on the server. */
export function isKitchenTicketMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message === "KITCHEN_TICKET_NOT_FOUND" || isKitchenTicketNotFoundMessage(message);
}

export async function bumpKitchenPriority(branchCode: string): Promise<void> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/kitchen/tickets/bump-priority?${params}`, { method: "POST" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Bump priority failed: ${res.status}`);
  }
}

export async function fetchKitchenCancellations(
  branchCode: string,
  opts?: { from?: string; to?: string },
): Promise<KitchenLineCancellationList> {
  const params = new URLSearchParams({ branchCode });
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const res = await authFetch(`/v1/kitchen/cancellations?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Kitchen cancellations failed: ${res.status}`);
  }
  return kitchenLineCancellationListSchema.parse(await res.json());
}
