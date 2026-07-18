import {
  formatMenuItemLabel,
  type Bill,
  type KitchenTicket,
  type MenuItem,
} from "@platform/contracts";
import type { CartLine } from "./orderDrafts";

export type StoredOrderLine = {
  label: string;
  qty: number;
  unitPrice?: number;
  menuItemId?: string;
};

export type EditingOrder =
  | { kind: "ticket"; ticketId: string }
  | { kind: "bill"; billId: string };

export function tableNumberFromStation(stationLabel: string): string | null {
  const match = stationLabel.match(/^Table\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function canEditKitchenTicket(ticket: KitchenTicket): boolean {
  return ticket.status !== "done";
}

export function tableStationLabel(tableNumber: string): string {
  return `Table ${tableNumber.trim()}`;
}

export function canEditHeldBill(bill: Bill): boolean {
  return bill.status === "held";
}

/** Legacy tickets without a recorded owner stay editable by everyone. */
export function ownsKitchenTicket(
  ticket: KitchenTicket,
  userId: string | null | undefined,
): boolean {
  if (!ticket.createdById) return true;
  return Boolean(userId) && ticket.createdById === userId;
}

/** Dine-in running ticket that can be moved to another table. */
export function canTransferKitchenTicket(
  ticket: KitchenTicket,
  userId?: string | null,
): boolean {
  if (ticket.status === "done") return false;
  const label = ticket.stationLabel.trim().toLowerCase();
  if (label.includes("delivery") || label.includes("takeaway")) return false;
  return ownsKitchenTicket(ticket, userId);
}

export function ownsHeldBill(bill: Bill, userId: string | null | undefined): boolean {
  if (!bill.waiterId) return true;
  return Boolean(userId) && bill.waiterId === userId;
}

export function extractKitchenNotes(ticket: KitchenTicket): string {
  if (ticket.notes?.trim()) return ticket.notes.trim();
  const parts = ticket.itemsSummary.split(" · ");
  if (parts.length > 1) return parts.slice(1).join(" · ").trim();
  return "";
}

function parseItemsSummary(summary: string): StoredOrderLine[] {
  return summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]) }
        : { label: part, qty: 1 };
    });
}

function matchMenuItem(menuItems: MenuItem[], line: StoredOrderLine): MenuItem | undefined {
  if (line.menuItemId) {
    const byId = menuItems.find((item) => item.id === line.menuItemId);
    if (byId) return byId;
  }
  const normalized = line.label.toLowerCase();
  return menuItems.find((item) => {
    const full = formatMenuItemLabel(item).toLowerCase();
    if (full === normalized) return true;
    if (item.name.toLowerCase() === normalized) return true;
    return normalized.startsWith(item.name.toLowerCase());
  });
}

export function cartFromStoredLines(menuItems: MenuItem[], lines: StoredOrderLine[]): CartLine[] {
  const cart: CartLine[] = [];
  for (const line of lines) {
    const item = matchMenuItem(menuItems, line);
    if (!item) continue;
    const existing = cart.find((row) => row.item.id === item.id);
    if (existing) existing.qty += line.qty;
    else cart.push({ item, qty: line.qty });
  }
  return cart;
}

export function cartFromKitchenTicket(menuItems: MenuItem[], ticket: KitchenTicket): CartLine[] {
  const lines: StoredOrderLine[] =
    ticket.lines && ticket.lines.length > 0
      ? ticket.lines
      : parseItemsSummary(ticket.itemsSummary.split(" · ")[0]?.trim() || ticket.itemsSummary);
  return cartFromStoredLines(menuItems, lines);
}

export function cartFromBill(menuItems: MenuItem[], bill: Bill): CartLine[] {
  const lines: StoredOrderLine[] = bill.lines.map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice,
    menuItemId: line.menuItemId,
  }));
  return cartFromStoredLines(menuItems, lines);
}

export function resolveTableKey(stationOrTableLabel: string): string {
  return tableNumberFromStation(stationOrTableLabel) ?? stationOrTableLabel.trim();
}
