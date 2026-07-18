import {
  formatMenuItemLabel,
  menuItemDisplayPrice,
  type Bill,
  type DeliveryOrder,
  type KitchenTicket,
  type MenuItem,
} from "@platform/contracts";
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

type PricedLine = {
  label: string;
  qty: number;
  unitPrice?: number | null;
  menuItemId?: string;
};

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

/** Matches the service/tax rates used when taking a new order in app/order.tsx. */
const SERVICE_PCT = 10;
const TAX_PCT = 0.15;

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveLineUnitPrice(line: PricedLine, menuItems?: MenuItem[]): number {
  const stored = Math.max(0, Number(line.unitPrice) || 0);
  if (stored > 0) return stored;
  if (!menuItems?.length) return 0;

  if (line.menuItemId) {
    const byId = menuItems.find((item) => item.id === line.menuItemId);
    if (byId) return menuItemDisplayPrice(byId);
  }

  const norm = normalizeLabel(line.label);
  const match = menuItems.find((item) => {
    const full = normalizeLabel(formatMenuItemLabel(item));
    const name = normalizeLabel(item.name);
    return full === norm || name === norm || norm.startsWith(name) || norm.includes(name);
  });
  return match ? menuItemDisplayPrice(match) : 0;
}

/** Pull food lines from itemsSummary when API lines are missing or unpriced. */
function linesFromItemsSummary(summary: string | undefined): PricedLine[] {
  if (!summary?.trim()) return [];
  const deliverySplit = summary.split(/\s·\s*Delivery\b/i)[0] ?? summary;
  const foodPart = deliverySplit.split(" · ")[0]?.trim() ?? deliverySplit.trim();
  if (!foodPart) return [];

  return foodPart
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]), unitPrice: 0 }
        : { label: part, qty: 1, unitPrice: 0 };
    });
}

function withResolvedPrices(lines: PricedLine[], menuItems?: MenuItem[]): PricedLine[] {
  return lines.map((line) => ({
    ...line,
    unitPrice: resolveLineUnitPrice(line, menuItems),
  }));
}

function linesSubtotal(lines: PricedLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.max(0, Number(line.unitPrice) || 0) * line.qty,
    0,
  );
}

/** Food total (subtotal + service + tax) from priced line items. */
function estimatedLinesTotal(
  lines: PricedLine[] | undefined,
  menuItems?: MenuItem[],
  summaryFallback?: string,
): number | null {
  let resolved = withResolvedPrices(lines ?? [], menuItems);
  let subtotal = linesSubtotal(resolved);

  // Lines may exist with unitPrice 0 and unmatched labels — fall back to itemsSummary + menu.
  if (subtotal <= 0) {
    const fromSummary = withResolvedPrices(linesFromItemsSummary(summaryFallback), menuItems);
    const summaryTotal = linesSubtotal(fromSummary);
    if (summaryTotal > 0) {
      resolved = fromSummary;
      subtotal = summaryTotal;
    }
  }

  if (subtotal <= 0) return null;
  const service = Math.round(subtotal * (SERVICE_PCT / 100));
  const tax = Math.round((subtotal + service) * TAX_PCT);
  return subtotal + service + tax;
}

export function unifiedOrderTotal(
  order: UnifiedOrder,
  menuItems?: MenuItem[],
): number | null {
  if (order.source === "bill") {
    const billTotal = Number(order.bill.total);
    if (Number.isFinite(billTotal) && billTotal > 0) return billTotal;
    const fromLines = estimatedLinesTotal(order.bill.lines, menuItems);
    if (fromLines == null) return null;
    return fromLines + (order.bill.deliveryChargePkr ?? 0);
  }
  return kitchenTicketTotal(order.ticket, menuItems);
}

/** Full bill total for a rider's delivery order — food + service + tax + delivery fee. */
export function deliveryOrderTotal(
  order: DeliveryOrder,
  menuItems?: MenuItem[],
): number | null {
  const foodTotal = estimatedLinesTotal(order.lines, menuItems, order.itemsSummary);
  const deliveryFee = Math.max(0, Number(order.deliveryChargePkr) || 0);
  if (foodTotal == null) return deliveryFee > 0 ? deliveryFee : null;
  return foodTotal + deliveryFee;
}

/** Kitchen / delivery ticket total for waiter lists. */
export function kitchenTicketTotal(
  ticket: {
    lines?: PricedLine[];
    itemsSummary?: string;
    deliveryChargePkr?: number | null;
  },
  menuItems?: MenuItem[],
): number | null {
  const food = estimatedLinesTotal(ticket.lines, menuItems, ticket.itemsSummary);
  if (food == null) return null;
  return food + Math.max(0, Number(ticket.deliveryChargePkr) || 0);
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
