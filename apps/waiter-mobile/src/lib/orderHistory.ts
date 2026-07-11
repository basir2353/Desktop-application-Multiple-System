import type { Bill, KitchenTicket } from "@platform/contracts";
import {
  canEditHeldBill,
  canEditKitchenTicket,
  ownsHeldBill,
  ownsKitchenTicket,
} from "./loadOrder";
import { billStatusLabel, kitchenStatusLabel, orderRefFromBill, orderRefFromTicket } from "./orderDisplay";

export type UnifiedOrder =
  | { source: "bill"; id: string; createdAt: string; bill: Bill }
  | { source: "kitchen"; id: string; createdAt: string; ticket: KitchenTicket };

export function buildUnifiedOrders(bills: Bill[], tickets: KitchenTicket[]): UnifiedOrder[] {
  const eligibleBills = bills.filter(
    (bill) =>
      (bill.status === "completed" || bill.status === "held") && !bill.billRef.endsWith("-SEED"),
  );
  const billedOrderRefs = new Set(
    eligibleBills.map((bill) => bill.orderRef).filter((ref): ref is string => Boolean(ref)),
  );

  const kitchenRows = tickets.filter(
    (ticket) => !ticket.orderRef || !billedOrderRefs.has(ticket.orderRef),
  );

  const rows: UnifiedOrder[] = [
    ...eligibleBills.map((bill) => ({
      source: "bill" as const,
      id: bill.id,
      createdAt: bill.createdAt,
      bill,
    })),
    ...kitchenRows.map((ticket) => ({
      source: "kitchen" as const,
      id: ticket.id,
      createdAt: ticket.createdAt,
      ticket,
    })),
  ];

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function unifiedOrderRef(order: UnifiedOrder): string {
  if (order.source === "bill") return orderRefFromBill(order.bill);
  return orderRefFromTicket(order.ticket);
}

export function unifiedOrderTable(order: UnifiedOrder): string {
  if (order.source === "bill") return order.bill.tableLabel;
  return order.ticket.stationLabel;
}

export function unifiedOrderSummary(order: UnifiedOrder): string {
  if (order.source === "bill") {
    return order.bill.lines.map((line) => `${line.label} ×${line.qty}`).join(", ");
  }
  return order.ticket.itemsSummary;
}

export function unifiedOrderStatus(order: UnifiedOrder): string {
  if (order.source === "bill") return billStatusLabel(order.bill.status);
  return kitchenStatusLabel(order.ticket.status);
}

export function unifiedOrderTotal(order: UnifiedOrder): number | null {
  if (order.source === "bill") return order.bill.total;
  return null;
}

export function canEditUnifiedOrder(
  order: UnifiedOrder,
  userId?: string | null,
): boolean {
  if (order.source === "kitchen") {
    return (
      canEditKitchenTicket(order.ticket) &&
      (userId === undefined || ownsKitchenTicket(order.ticket, userId))
    );
  }
  return (
    canEditHeldBill(order.bill) && (userId === undefined || ownsHeldBill(order.bill, userId))
  );
}

/** Owner display name for an order taken by someone else, else null. */
export function unifiedOrderOwnerLabel(
  order: UnifiedOrder,
  userId: string | null,
): string | null {
  if (order.source === "kitchen") {
    if (ownsKitchenTicket(order.ticket, userId)) return null;
    return order.ticket.createdByName ?? "another waiter";
  }
  if (order.bill.status !== "held" || ownsHeldBill(order.bill, userId)) return null;
  return order.bill.waiterName;
}

export function orderStatusAccent(order: UnifiedOrder): string {
  const status = unifiedOrderStatus(order).toLowerCase();
  if (status === "paid" || status === "ready") return "#22c55e";
  if (status === "cooking") return "#38bdf8";
  if (status === "on hold" || status === "new") return "#f59e0b";
  return "#94a3b8";
}

export function matchesOrderSearch(order: UnifiedOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const parts = [
    unifiedOrderRef(order),
    unifiedOrderTable(order),
    unifiedOrderSummary(order),
    unifiedOrderStatus(order),
    order.source === "bill" ? order.bill.billRef : order.ticket.ticketRef,
    order.source === "bill" ? order.bill.waiterName : "kitchen",
  ];

  if (order.source === "bill") {
    parts.push(
      ...order.bill.lines.map((line) => `${line.label} ${line.qty}`),
    );
  }

  return parts.join(" ").toLowerCase().includes(q);
}
