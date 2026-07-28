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

/** Parse "Delivery · {name} · {phone?} · {address}" from bill notes or ticket items summary. */
export function parseDeliveryContact(text: string | null | undefined): {
  customer: string;
  address: string;
  phone: string;
} {
  if (!text?.trim()) return { customer: "—", address: "—", phone: "" };

  const parts = text
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const deliveryIdx = parts.findIndex((p) => p.toLowerCase() === "delivery");
  const rest = deliveryIdx >= 0 ? parts.slice(deliveryIdx + 1) : [];

  const looksLikePhone = (value: string): boolean =>
    /^\+?\d[\d\s()-]{5,}$/.test(value.trim()) && !/[a-zA-Z]{2,}/.test(value);

  if (rest.length >= 3) {
    const customer = rest[0] || "—";
    if (looksLikePhone(rest[1])) {
      return { customer, phone: rest[1], address: rest.slice(2).join(" · ") || "—" };
    }
    return { customer, phone: "", address: rest.slice(1).join(" · ") || "—" };
  }

  if (rest.length === 2) {
    if (looksLikePhone(rest[0]) && !looksLikePhone(rest[1])) {
      return { customer: "—", phone: rest[0], address: rest[1] };
    }
    if (looksLikePhone(rest[1]) && !looksLikePhone(rest[0])) {
      return { customer: rest[0], phone: rest[1], address: "—" };
    }
    return { customer: rest[0] || "—", phone: "", address: rest[1] || "—" };
  }

  if (rest.length === 1) {
    if (looksLikePhone(rest[0])) return { customer: "—", phone: rest[0], address: "—" };
    return { customer: rest[0], phone: "", address: "—" };
  }

  return { customer: "—", address: "—", phone: "" };
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
