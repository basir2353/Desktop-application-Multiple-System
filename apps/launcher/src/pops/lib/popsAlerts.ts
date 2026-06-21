import type { KitchenTicket } from "@platform/contracts";
import type { InventoryDashboard } from "@platform/contracts";

export const KITCHEN_SLOW_WARN_MINS = 15;
export const KITCHEN_SLOW_ALERT_MINS = 20;

export type PopsAlertTone = "info" | "warning" | "danger";

export type PopsAlertKind = "new_order" | "kitchen_slow" | "low_stock";

export type PopsAlert = {
  id: string;
  kind: PopsAlertKind;
  tone: PopsAlertTone;
  title: string;
  message: string;
  href?: string;
  at: string;
};

export function kitchenAlertsFromTickets(tickets: KitchenTicket[]): PopsAlert[] {
  const alerts: PopsAlert[] = [];
  const now = new Date().toISOString();

  for (const ticket of tickets) {
    if (ticket.status === "done") continue;

    if (ticket.mins >= KITCHEN_SLOW_ALERT_MINS) {
      alerts.push({
        id: `kitchen-slow-${ticket.id}`,
        kind: "kitchen_slow",
        tone: "danger",
        title: "Kitchen delay",
        message: `${ticket.ticketRef} · ${ticket.stationLabel} — ${ticket.mins} min waiting`,
        href: "/pops/kitchen",
        at: now,
      });
    } else if (ticket.mins >= KITCHEN_SLOW_WARN_MINS) {
      alerts.push({
        id: `kitchen-warn-${ticket.id}`,
        kind: "kitchen_slow",
        tone: "warning",
        title: "Order taking long",
        message: `${ticket.ticketRef} · ${ticket.stationLabel} — ${ticket.mins} min in kitchen`,
        href: "/pops/kitchen",
        at: now,
      });
    }
  }

  return alerts.sort((a, b) => {
    const toneRank = { danger: 0, warning: 1, info: 2 };
    return toneRank[a.tone] - toneRank[b.tone];
  });
}

export function newOrderAlert(ticket: KitchenTicket): PopsAlert {
  return {
    id: `new-order-${ticket.id}`,
    kind: "new_order",
    tone: "info",
    title: "New order",
    message: `${ticket.ticketRef} · ${ticket.stationLabel} — ${ticket.itemsSummary.split(" · Delivery")[0]}`,
    href: "/pops/kitchen",
    at: ticket.createdAt,
  };
}

export function inventoryAlertsFromDashboard(dashboard: InventoryDashboard): PopsAlert[] {
  return dashboard.alerts.map((alert, index) => {
    const isOut = alert.type.toLowerCase().includes("out");
    const tone: PopsAlertTone =
      alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "warning" : "info";

    return {
      id: `stock-${index}-${alert.message}`,
      kind: "low_stock",
      tone,
      title: isOut ? "Out of stock" : "Low stock",
      message: alert.message,
      href: "/pops/inventory/ingredients",
      at: new Date().toISOString(),
    };
  });
}

export function mergeAlerts(...groups: PopsAlert[][]): PopsAlert[] {
  const seen = new Set<string>();
  const merged: PopsAlert[] = [];

  for (const group of groups) {
    for (const alert of group) {
      if (seen.has(alert.id)) continue;
      seen.add(alert.id);
      merged.push(alert);
    }
  }

  const toneRank: Record<PopsAlertTone, number> = { danger: 0, warning: 1, info: 2 };
  const kindRank: Record<PopsAlertKind, number> = { kitchen_slow: 0, low_stock: 1, new_order: 2 };

  return merged.sort((a, b) => {
    const toneDiff = toneRank[a.tone] - toneRank[b.tone];
    if (toneDiff !== 0) return toneDiff;
    return kindRank[a.kind] - kindRank[b.kind];
  });
}
