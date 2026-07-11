import type { Bill, KitchenTicket } from "@platform/contracts";
import { tableNumberFromStation } from "./loadOrder";

export type TableOccupancy = {
  /** User id of the waiter who booked the table (null for legacy/desktop orders). */
  ownerId: string | null;
  ownerName: string | null;
  /** True when the current user booked it (or the order has no recorded owner). */
  mine: boolean;
};

function normalizeKey(tableNumber: string): string {
  return tableNumber.trim().toUpperCase();
}

/**
 * A table is "booked" while it has an active kitchen ticket (not done) or a
 * held bill. It frees up automatically once the order is done / bill closed.
 */
export function buildTableOccupancy(
  tickets: KitchenTicket[],
  bills: Bill[],
  myUserId: string | null | undefined,
): Map<string, TableOccupancy> {
  const map = new Map<string, TableOccupancy>();

  const claim = (
    tableNumber: string | null,
    ownerId: string | null,
    ownerName: string | null,
  ) => {
    if (!tableNumber) return;
    const key = normalizeKey(tableNumber);
    const existing = map.get(key);
    // Prefer an entry with a known owner over an anonymous one.
    if (existing && (existing.ownerId || !ownerId)) return;
    map.set(key, {
      ownerId,
      ownerName,
      mine: !ownerId || ownerId === myUserId,
    });
  };

  for (const ticket of tickets) {
    if (ticket.status === "done") continue;
    claim(
      tableNumberFromStation(ticket.stationLabel),
      ticket.createdById ?? null,
      ticket.createdByName ?? null,
    );
  }

  for (const bill of bills) {
    if (bill.status !== "held") continue;
    claim(tableNumberFromStation(bill.tableLabel), bill.waiterId, bill.waiterName);
  }

  return map;
}

export function occupancyForTable(
  occupancy: Map<string, TableOccupancy>,
  tableNumber: string | null | undefined,
): TableOccupancy | null {
  if (!tableNumber) return null;
  return occupancy.get(normalizeKey(tableNumber)) ?? null;
}
