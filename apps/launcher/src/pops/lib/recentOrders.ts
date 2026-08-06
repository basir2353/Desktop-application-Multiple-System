import type { Bill, KitchenTicket, KitchenTicketStatus } from "@platform/contracts";
import { billChannelLabel, type OrderChannelLabel } from "./orderSales";
import { computeTicketTotals, discountAmountFromPct } from "./posDiscount";
import type { PosSettings } from "./posSettings";
import { DEFAULT_POS_SETTINGS, effectiveServicePctForMode, effectiveTaxPctForMode } from "./posSettings";
import { parseTicketDiscountFromNotes, resolveTicketDeliveryNotes } from "./posLoadOrder";
import { inferPosModeFromLabel, type PosOrderModeLabel } from "./posOrderMode";

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
  orderMode: OrderChannelLabel;
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

export function canPayPosRecentOrder(order: PosRecentOrder): boolean {
  if (order.kind === "pending" && order.kitchenTicket) return true;
  if (order.bill?.status === "held") return true;
  return false;
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
  const mode = inferPosModeFromLabel(order.stationLabel ?? order.orderMode ?? "");
  const notes = resolveTicketDeliveryNotes(order.kitchenTicket ?? {}) ?? order.kitchenTicket?.notes;
  const savedDisc = parseTicketDiscountFromNotes(notes);
  const discAmount = savedDisc
    ? savedDisc.editedAs === "pct"
      ? discountAmountFromPct(savedDisc.pct, subtotal)
      : savedDisc.amount
    : 0;
  return computeTicketTotals(
    subtotal,
    discAmount,
    effectiveServicePctForMode(settings, mode),
    effectiveTaxPctForMode(settings, mode),
    delivery,
  ).total;
}

function mapTicket(t: KitchenTicket, settings: PosSettings): PosRecentOrder {
  const { label, tone } = ticketStatus(t.status);
  const lines = t.lines && t.lines.length > 0
    ? t.lines.map((l) => ({ label: l.label, qty: l.qty, unitPrice: l.unitPrice }))
    : parseItemsSummary(t.itemsSummary);
  const resolvedLines =
    lines.length > 0 ? lines : [{ label: t.itemsSummary || "Items", qty: 1, unitPrice: null }];
  const subtotal = linesSubtotal(resolvedLines);
  const servicePct = effectiveServicePctForMode(settings, inferPosModeFromLabel(t.stationLabel));
  const mode = inferPosModeFromLabel(t.stationLabel);
  const notes = resolveTicketDeliveryNotes(t) ?? t.notes;
  const savedDisc = parseTicketDiscountFromNotes(notes);
  const discAmount = savedDisc
    ? savedDisc.editedAs === "pct"
      ? discountAmountFromPct(savedDisc.pct, subtotal)
      : savedDisc.amount
    : 0;
  const total =
    subtotal > 0
      ? computeTicketTotals(
          subtotal,
          discAmount,
          servicePct,
          effectiveTaxPctForMode(settings, mode),
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
  const paidBills = bills.filter((b) => !b.billRef.endsWith("-SEED"));
  const paid = paidBills.map(mapBill);

  // Hide an open KOT only when a held/completed bill for the same ORD-# was created
  // at/after that ticket (same order paid). Do NOT hide newer tickets that reused an
  // ORD-# after a local counter reset — those must stay visible in Latest orders.
  const settledByRef = new Map<string, number>();
  for (const bill of paidBills) {
    if (bill.status !== "completed" && bill.status !== "held") continue;
    const ref = (bill.orderRef ?? "").trim().toLowerCase();
    if (!ref) continue;
    const at = new Date(bill.createdAt).getTime();
    const prev = settledByRef.get(ref);
    if (prev == null || at > prev) settledByRef.set(ref, at);
  }

  const pending = tickets
    .filter((t) => t.status !== "done")
    .filter((t) => {
      const ref = (t.orderRef ?? "").trim().toLowerCase();
      if (!ref) return true;
      const settledAt = settledByRef.get(ref);
      if (settledAt == null) return true;
      const ticketAt = new Date(t.createdAt).getTime();
      return ticketAt > settledAt;
    })
    .map((t) => mapTicket(t, settings));

  const sorted = [...pending, ...paid].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const limit = options?.limit;
  return limit != null ? sorted.slice(0, limit) : sorted;
}

export type PosRecentOrderModeFilter = "all" | "Paid" | PosOrderModeLabel;

/** Completed (cashed) bills only — shown under the Paid tab (incl. Closed). */
export function isPaidPosRecentOrder(order: PosRecentOrder): boolean {
  if (order.bill?.status === "completed") return true;
  return (
    order.kind === "paid" &&
    (order.statusLabel === "Paid" || order.statusLabel === "Closed")
  );
}

export function filterPosRecentOrdersByMode(
  orders: PosRecentOrder[],
  mode: PosRecentOrderModeFilter,
): PosRecentOrder[] {
  if (mode === "Paid") {
    return orders.filter(isPaidPosRecentOrder);
  }
  // Paid / Closed bills only appear under the Paid tab — never All or mode tabs.
  const unpaid = orders.filter((order) => !isPaidPosRecentOrder(order));
  if (mode === "all") {
    return unpaid;
  }
  return unpaid.filter((order) => order.orderMode === mode);
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

/** Hide Closed orders from All; Paid tab keeps them with a Closed label. */
export function filterDismissedPosOrders(orders: PosRecentOrder[], branchCode: string): PosRecentOrder[] {
  const dismissed = loadDismissedPosOrderIds(branchCode);
  if (dismissed.size === 0) return orders;
  return orders.filter((order) => !dismissed.has(order.id));
}

/** Mark locally closed (Dismiss/Close) orders so Paid tab can show status "Closed". */
export function withClosedPosOrderStatus(
  orders: PosRecentOrder[],
  branchCode: string,
): PosRecentOrder[] {
  const dismissed = loadDismissedPosOrderIds(branchCode);
  if (dismissed.size === 0) return orders;
  return orders.map((order) => {
    if (!dismissed.has(order.id)) return order;
    return {
      ...order,
      statusLabel: "Closed",
      statusTone: "neutral" as const,
    };
  });
}

export function formatRecentOrderTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  return formatOrderDateTime(iso);
}

export function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
