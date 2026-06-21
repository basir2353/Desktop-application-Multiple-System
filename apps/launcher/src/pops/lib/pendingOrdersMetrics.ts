import type { KitchenTicket } from "@platform/contracts";
import type { ChartSegment } from "./orderSales";
import { billChannelLabel } from "./orderSales";

export type PendingOrdersSummary = {
  total: number;
  newCount: number;
  cookingCount: number;
  readyCount: number;
  priorityCount: number;
  slaStatus: "green" | "yellow" | "red";
  dineIn: number;
  takeaway: number;
  delivery: number;
};

export function summarizePendingOrders(tickets: KitchenTicket[]): PendingOrdersSummary {
  const newCount = tickets.filter((t) => t.status === "new").length;
  const cookingCount = tickets.filter((t) => t.status === "cooking").length;
  const readyCount = tickets.filter((t) => t.status === "ready").length;
  const priorityCount = tickets.filter((t) => t.priority === "priority").length;
  const total = tickets.length;
  const slaStatus = total > 12 ? "red" : total > 8 ? "yellow" : "green";

  return {
    total,
    newCount,
    cookingCount,
    readyCount,
    priorityCount,
    slaStatus,
    dineIn: tickets.filter((t) => billChannelLabel(t.stationLabel) === "Dine-in").length,
    takeaway: tickets.filter((t) => billChannelLabel(t.stationLabel) === "Takeaway").length,
    delivery: tickets.filter((t) => billChannelLabel(t.stationLabel) === "Delivery").length,
  };
}

/** Bar chart data for open pending orders by kitchen status. */
export function pendingOrdersStatusBars(
  tickets: KitchenTicket[],
): { label: string; value: number; color: string }[] {
  const summary = summarizePendingOrders(tickets);
  return [
    { label: "New", value: summary.newCount, color: "rgb(251 191 36)" },
    { label: "Cooking", value: summary.cookingCount, color: "rgb(56 189 248)" },
    { label: "Ready", value: summary.readyCount, color: "rgb(52 211 153)" },
  ];
}

/** Donut-style segments for pending orders by service type (from station label). */
export function pendingOrdersChannelSegments(tickets: KitchenTicket[]): ChartSegment[] {
  const summary = summarizePendingOrders(tickets);
  return [
    { label: "Dine-in", value: summary.dineIn, color: "rgb(52 211 153)" },
    { label: "Takeaway", value: summary.takeaway, color: "rgb(56 189 248)" },
    { label: "Delivery", value: summary.delivery, color: "rgb(167 139 250)" },
  ];
}
