import type { Bill, KitchenTicket, KitchenTicketStatus } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { computeTicketTotals } from "./posDiscount";
import type { PosSettings } from "./posSettings";
import { DEFAULT_POS_SETTINGS } from "./posSettings";
import type { PosOrderModeLabel } from "./posOrderMode";

export type PosOrderLine = {
  label: string;
  qty: number;
  unitPrice: number | null;
};

export type PosRecentOrderDetail =
  | {
      kind: "pending";
      ticketRef: string;
      orderRef: string | null;
      priority: string;
      mins: number;
      startedAt: string | null;
      lines: PosOrderLine[];
    }
  | {
      kind: "paid";
      billRef: string;
      orderRef: string | null;
      waiterName: string;
      notes: string | null;
      subtotal: number;
      discount: number;
      service: number;
      tax: number;
      total: number;
      status: string;
      lines: PosOrderLine[];
    };

export type PosRecentOrder = {
  id: string;
  ref: string;
  orderMode: "Dine-in" | "Takeaway" | "Delivery";
  stationLabel: string;
  summary: string;
  total: number | null;
  kind: "pending" | "paid";
  statusLabel: string;
  statusTone: "warning" | "info" | "success" | "neutral";
  createdAt: string;
  detail: PosRecentOrderDetail;
  /** Original bill for paid orders (reprint, etc.). */
  bill?: Bill;
  /** Original kitchen ticket for pending orders (KOT reprint, etc.). */
  kitchenTicket?: KitchenTicket;
  /** Set for open kitchen tickets (table change, etc.). */
  pendingTicket?: {
    id: string;
    stationLabel: string;
    orderRef: string | null;
    ticketRef: string;
    createdAt: string;
  };
};

export function canChangePosRecentOrderTable(order: PosRecentOrder): boolean {
  return order.kind === "pending" && order.orderMode === "Dine-in" && Boolean(order.pendingTicket);
}

export function canEditPosRecentOrder(order: PosRecentOrder): boolean {
  if (order.kind === "pending" && order.kitchenTicket && order.kitchenTicket.status !== "done") {
    return true;
  }
  if (order.kind === "paid" && order.bill?.status === "held") {
    return true;
  }
  return false;
}

function ticketStatus(status: KitchenTicketStatus): { label: string; tone: PosRecentOrder["statusTone"] } {
  if (status === "new") return { label: "New", tone: "warning" };
  if (status === "cooking") return { label: "Cooking", tone: "info" };
  if (status === "ready") return { label: "Ready", tone: "success" };
  return { label: "Done", tone: "neutral" };
}

export function parseItemsSummary(summary: string): PosOrderLine[] {
  return summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]), unitPrice: null }
        : { label: part, qty: 1, unitPrice: null };
    });
}

function linesSubtotal(lines: PosOrderLine[]): number {
  return lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
}

export function posRecentOrderTotal(
  order: PosRecentOrder,
  settings: PosSettings = DEFAULT_POS_SETTINGS,
): number | null {
  if (order.total != null && order.total > 0) return order.total;
  if (order.kind === "paid" && order.detail.kind === "paid") return order.detail.total;

  const lines = order.detail.kind === "pending" ? order.detail.lines : [];
  const subtotal = linesSubtotal(lines);
  if (subtotal <= 0) return null;

  const delivery = order.kitchenTicket?.deliveryChargePkr ?? 0;
  return computeTicketTotals(subtotal, 0, settings.servicePct, settings.taxPct, delivery).total;
}

function mapTicket(t: KitchenTicket, settings: PosSettings): PosRecentOrder {
  const { label, tone } = ticketStatus(t.status);
  const lines = t.lines && t.lines.length > 0
    ? t.lines.map((l) => ({ label: l.label, qty: l.qty, unitPrice: l.unitPrice }))
    : parseItemsSummary(t.itemsSummary);
  const resolvedLines =
    lines.length > 0 ? lines : [{ label: t.itemsSummary || "Items", qty: 1, unitPrice: null }];
  const subtotal = linesSubtotal(resolvedLines);
  const total =
    subtotal > 0
      ? computeTicketTotals(
          subtotal,
          0,
          settings.servicePct,
          settings.taxPct,
          t.deliveryChargePkr ?? 0,
        ).total
      : null;

  return {
    id: `kot-${t.id}`,
    ref: t.orderRef ?? t.ticketRef,
    orderMode: billChannelLabel(t.stationLabel),
    stationLabel: t.stationLabel,
    summary: t.itemsSummary,
    total,
    kind: "pending",
    statusLabel: label,
    statusTone: tone,
    createdAt: t.createdAt,
    kitchenTicket: t,
    pendingTicket: {
      id: t.id,
      stationLabel: t.stationLabel,
      orderRef: t.orderRef,
      ticketRef: t.ticketRef,
      createdAt: t.createdAt,
    },
    detail: {
      kind: "pending",
      ticketRef: t.ticketRef,
      orderRef: t.orderRef,
      priority: t.priority,
      mins: t.mins,
      startedAt: t.startedAt,
      lines: resolvedLines,
    },
  };
}

function mapBill(b: Bill): PosRecentOrder {
  const lines: PosOrderLine[] = b.lines.map((l) => ({
    label: l.label,
    qty: l.qty,
    unitPrice: l.unitPrice,
  }));
  const isHeld = b.status === "held";
  return {
    id: `bill-${b.id}`,
    ref: b.orderRef ?? b.billRef,
    orderMode: billChannelLabel(b.tableLabel),
    stationLabel: b.tableLabel,
    summary: lines.map((l) => `${l.label} x${l.qty}`).join(", "),
    total: b.total,
    kind: "paid",
    statusLabel: isHeld ? "On hold" : "Paid",
    statusTone: isHeld ? "warning" : "success",
    createdAt: b.createdAt,
    bill: b,
    detail: {
      kind: "paid",
      billRef: b.billRef,
      orderRef: b.orderRef,
      waiterName: b.waiterName,
      notes: b.notes,
      subtotal: b.subtotal,
      discount: b.discount,
      service: b.service,
      tax: b.tax,
      total: b.total,
      status: b.status,
      lines,
    },
  };
}

export function buildPosRecentOrders(
  tickets: KitchenTicket[],
  bills: Bill[],
  options?: { limit?: number; settings?: PosSettings },
): PosRecentOrder[] {
  const settings = options?.settings ?? DEFAULT_POS_SETTINGS;
  const pending = tickets.filter((t) => t.status !== "done").map((t) => mapTicket(t, settings));
  const paid = bills.filter((b) => !b.billRef.endsWith("-SEED")).map(mapBill);

  const sorted = [...pending, ...paid].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const limit = options?.limit;
  return limit != null ? sorted.slice(0, limit) : sorted;
}

export type PosRecentOrderModeFilter = "all" | PosOrderModeLabel;

export function filterPosRecentOrdersByMode(
  orders: PosRecentOrder[],
  mode: PosRecentOrderModeFilter,
): PosRecentOrder[] {
  if (mode === "all") return orders;
  return orders.filter((order) => order.orderMode === mode);
}

export function filterPosRecentOrders(
  orders: PosRecentOrder[],
  query: string,
  mode: PosRecentOrderModeFilter = "all",
): PosRecentOrder[] {
  const filtered = filterPosRecentOrdersByMode(orders, mode);
  const q = query.trim().toLowerCase();
  if (!q) return filtered;

  return filtered.filter((order) => {
    const { detail } = order;
    const haystack = [
      order.ref,
      order.stationLabel,
      order.summary,
      order.orderMode,
      order.statusLabel,
      detail.kind === "paid" ? detail.billRef : detail.ticketRef,
      detail.kind === "paid" ? detail.waiterName : "",
      detail.orderRef ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const POS_RECENT_ORDERS_PREVIEW_LIMIT = 21;

const DISMISSED_ORDERS_KEY = "pops-pos-dismissed-orders";

function dismissedOrdersKey(branchCode: string): string {
  return `${DISMISSED_ORDERS_KEY}:${branchCode}`;
}

export function loadDismissedPosOrderIds(branchCode: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedOrdersKey(branchCode));
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function dismissPosOrder(branchCode: string, orderId: string): void {
  const ids = loadDismissedPosOrderIds(branchCode);
  ids.add(orderId);
  localStorage.setItem(dismissedOrdersKey(branchCode), JSON.stringify([...ids]));
}

export function filterDismissedPosOrders(orders: PosRecentOrder[], branchCode: string): PosRecentOrder[] {
  const dismissed = loadDismissedPosOrderIds(branchCode);
  if (dismissed.size === 0) return orders;
  return orders.filter((order) => !dismissed.has(order.id));
}

export function formatRecentOrderTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
}

export function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
