import type { Bill, KitchenTicket, KitchenTicketStatus } from "@platform/contracts";
import {
  billChannelLabel,
  filterOrdersByDateTime,
  karachiTime,
  karachiYear,
  ordersPageBills,
  timeToMinutes,
  businessDateKey,
  type OrderDateFilters,
} from "./orderSales";
import { DEFAULT_BUSINESS_DAY, type BusinessDaySettings } from "./businessDay";
import { computeTicketTotals } from "./posDiscount";
import type { PosSettings } from "./posSettings";
import { DEFAULT_POS_SETTINGS } from "./posSettings";

export type UnifiedOrder =
  | { source: "bill"; id: string; createdAt: string; bill: Bill }
  | { source: "kitchen"; id: string; createdAt: string; ticket: KitchenTicket };

export function buildUnifiedOrders(bills: Bill[], tickets: KitchenTicket[]): UnifiedOrder[] {
  const completed = ordersPageBills(bills);
  const billedOrderRefs = new Set(
    completed.map((b) => b.orderRef).filter((ref): ref is string => Boolean(ref)),
  );

  const pendingTickets = tickets.filter(
    (t) => !t.orderRef || !billedOrderRefs.has(t.orderRef),
  );

  const rows: UnifiedOrder[] = [
    ...completed.map((bill) => ({
      source: "bill" as const,
      id: bill.id,
      createdAt: bill.createdAt,
      bill,
    })),
    ...pendingTickets.map((ticket) => ({
      source: "kitchen" as const,
      id: ticket.id,
      createdAt: ticket.createdAt,
      ticket,
    })),
  ];

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function filterUnifiedOrdersByDateTime(
  orders: UnifiedOrder[],
  filters: OrderDateFilters,
  businessDay: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): UnifiedOrder[] {
  return orders.filter((order) => {
    const iso = order.createdAt;
    if (filters.year && filters.year !== "all" && karachiYear(iso) !== filters.year) {
      return false;
    }
    if (filters.date && businessDateKey(iso, businessDay) !== filters.date) {
      return false;
    }
    if (filters.timeFrom || filters.timeTo) {
      const mins = timeToMinutes(karachiTime(iso));
      if (filters.timeFrom && mins < timeToMinutes(filters.timeFrom)) return false;
      if (filters.timeTo && mins > timeToMinutes(filters.timeTo)) return false;
    }
    return true;
  });
}

export function unifiedOrderRef(order: UnifiedOrder): string {
  if (order.source === "bill") {
    return order.bill.orderRef ?? order.bill.billRef;
  }
  return order.ticket.orderRef ?? order.ticket.ticketRef;
}

export function unifiedOrderTable(order: UnifiedOrder): string {
  if (order.source === "bill") return order.bill.tableLabel;
  return order.ticket.stationLabel;
}

/** Open kitchen ticket not yet billed. */
export function isRunningOrder(order: UnifiedOrder): boolean {
  return order.source === "kitchen";
}

export function canEditUnifiedOrder(order: UnifiedOrder): boolean {
  if (order.source === "kitchen" && order.ticket.status !== "done") return true;
  if (order.source === "bill" && order.bill.status === "held") return true;
  return false;
}

/** Dine-in running order whose table can be reassigned. */
export function canChangeOrderTable(order: UnifiedOrder): boolean {
  if (order.source !== "kitchen") return false;
  return billChannelLabel(order.ticket.stationLabel) === "Dine-in";
}

export function tableStationLabel(tableNumber: string): string {
  return `Table ${tableNumber.trim()}`;
}

export function unifiedOrderWaiter(order: UnifiedOrder): string {
  if (order.source === "bill") return order.bill.waiterName;
  return "Kitchen";
}

export type UnifiedOrderAmounts = {
  subtotal: number;
  service: number;
  total: number;
  servicePct: number;
};

function kitchenTicketSubtotal(ticket: KitchenTicket): number {
  return (ticket.lines ?? []).reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
}

export function unifiedOrderAmounts(
  order: UnifiedOrder,
  settings: PosSettings = DEFAULT_POS_SETTINGS,
): UnifiedOrderAmounts | null {
  if (order.source === "bill") {
    return {
      subtotal: order.bill.subtotal,
      service: order.bill.service,
      total: order.bill.total,
      servicePct: order.bill.servicePct,
    };
  }

  const subtotal = kitchenTicketSubtotal(order.ticket);
  if (subtotal <= 0) return null;

  const totals = computeTicketTotals(
    subtotal,
    0,
    settings.servicePct,
    settings.taxPct,
    order.ticket.deliveryChargePkr ?? 0,
  );

  return {
    subtotal: totals.subtotal,
    service: totals.service,
    total: totals.total,
    servicePct: settings.servicePct,
  };
}

export function unifiedOrderTotal(
  order: UnifiedOrder,
  settings: PosSettings = DEFAULT_POS_SETTINGS,
): number | null {
  return unifiedOrderAmounts(order, settings)?.total ?? null;
}

export function unifiedOrderService(
  order: UnifiedOrder,
  settings: PosSettings = DEFAULT_POS_SETTINGS,
): { servicePct: number; service: number } | null {
  const amounts = unifiedOrderAmounts(order, settings);
  if (!amounts) return null;
  return { servicePct: amounts.servicePct, service: amounts.service };
}

export type OrderSalesSummary = {
  paidTotal: number;
  paidCount: number;
  heldTotal: number;
  heldCount: number;
  openCount: number;
  openTotal: number;
  serviceTotal: number;
};

/** Sum bill totals for the orders currently shown in the list. */
export function summarizeOrderSales(
  orders: UnifiedOrder[],
  settings: PosSettings = DEFAULT_POS_SETTINGS,
): OrderSalesSummary {
  let paidTotal = 0;
  let paidCount = 0;
  let heldTotal = 0;
  let heldCount = 0;
  let openCount = 0;
  let openTotal = 0;
  let serviceTotal = 0;

  for (const order of orders) {
    const amounts = unifiedOrderAmounts(order, settings);
    if (order.source === "kitchen") {
      openCount += 1;
      if (amounts) {
        openTotal += amounts.total;
        serviceTotal += amounts.service;
      }
      continue;
    }
    if (order.bill.status === "completed") {
      paidTotal += order.bill.total;
      serviceTotal += order.bill.service;
      paidCount += 1;
    } else if (order.bill.status === "held") {
      heldTotal += order.bill.total;
      heldCount += 1;
    }
  }

  return { paidTotal, paidCount, heldTotal, heldCount, openCount, openTotal, serviceTotal };
}

export function unifiedOrderStatusLabel(order: UnifiedOrder): string {
  if (order.source === "bill") {
    if (order.bill.status === "completed") return "Paid";
    if (order.bill.status === "held") return "On hold";
    return order.bill.status;
  }
  return kitchenStatusLabel(order.ticket.status);
}

export function unifiedOrderStatusTone(
  order: UnifiedOrder,
): "warning" | "info" | "success" | "neutral" {
  if (order.source === "bill") {
    if (order.bill.status === "completed") return "success";
    if (order.bill.status === "held") return "warning";
    return "neutral";
  }
  return kitchenStatusTone(order.ticket.status);
}

function kitchenStatusLabel(status: KitchenTicketStatus): string {
  if (status === "new") return "New";
  if (status === "cooking") return "Cooking";
  if (status === "ready") return "Ready";
  return "Done";
}

function kitchenStatusTone(status: KitchenTicketStatus): "warning" | "info" | "success" | "neutral" {
  if (status === "new") return "warning";
  if (status === "cooking") return "info";
  if (status === "ready") return "success";
  return "neutral";
}

/** @deprecated use filterUnifiedOrdersByDateTime */
export { filterOrdersByDateTime };
