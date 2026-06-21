import type { Bill, DeliveryStatus, KitchenTicket } from "@platform/contracts";
import { DELIVERY_STATUS_LABELS } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { buildUnifiedOrders, type UnifiedOrder } from "./orderHistory";

export function isDeliveryOrder(order: UnifiedOrder): boolean {
  const label = order.source === "bill" ? order.bill.tableLabel : order.ticket.stationLabel;
  return billChannelLabel(label) === "Delivery";
}

export function buildDeliveryOrders(bills: Bill[], tickets: KitchenTicket[]): UnifiedOrder[] {
  return buildUnifiedOrders(bills, tickets).filter(isDeliveryOrder);
}

export function isActiveDeliveryOrder(order: UnifiedOrder): boolean {
  return order.source === "kitchen" && order.ticket.status !== "done";
}

/** Parse "Delivery · {name} · {address}" from bill notes or ticket items summary. */
export function parseDeliveryContact(text: string | null | undefined): {
  customer: string;
  address: string;
} {
  if (!text?.trim()) return { customer: "—", address: "—" };

  const parts = text.split("·").map((p) => p.trim());
  const deliveryIdx = parts.findIndex((p) => p.toLowerCase() === "delivery");
  if (deliveryIdx >= 0) {
    return {
      customer: parts[deliveryIdx + 1]?.trim() || "—",
      address: parts[deliveryIdx + 2]?.trim() || "—",
    };
  }

  return { customer: "—", address: "—" };
}

export function deliveryOrderContact(order: UnifiedOrder): { customer: string; address: string } {
  if (order.source === "bill") {
    return parseDeliveryContact(order.bill.notes);
  }
  return parseDeliveryContact(order.ticket.itemsSummary);
}

export function deliveryOrderItemsSummary(order: UnifiedOrder): string {
  if (order.source === "bill") {
    return order.bill.lines.map((l) => `${l.label} x${l.qty}`).join(", ");
  }

  const summary = order.ticket.itemsSummary;
  const marker = " · Delivery";
  const idx = summary.indexOf(marker);
  return idx >= 0 ? summary.slice(0, idx) : summary;
}

export function deliveryOrderCharge(order: UnifiedOrder): number {
  if (order.source === "bill") return order.bill.deliveryChargePkr;
  return order.ticket.deliveryChargePkr;
}

export function deliveryOrderRider(order: UnifiedOrder): string {
  if (order.source === "bill") return order.bill.riderName ?? "—";
  return order.ticket.riderName ?? "—";
}

export function deliveryOrderStatus(order: UnifiedOrder): DeliveryStatus | null {
  if (order.source === "bill") {
    return order.bill.status === "completed" ? "delivered" : null;
  }
  return order.ticket.deliveryStatus;
}

export function deliveryOrderStatusLabel(order: UnifiedOrder): string {
  const status = deliveryOrderStatus(order);
  if (!status) {
    return order.source === "kitchen" ? "In kitchen" : "—";
  }
  return DELIVERY_STATUS_LABELS[status];
}
