import type { Bill } from "@platform/contracts";

const KARACHI_TZ = "Asia/Karachi";

export function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function karachiDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function karachiTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

/** Calendar day in Asia/Karachi (midnight–midnight). */
export function currentBusinessDateKey(): string {
  return karachiDateKey(new Date());
}

export function payableCompletedOrders(orders: Bill[]): Bill[] {
  return orders.filter(
    (o) =>
      (o.status === "completed" || o.status === "held") &&
      !o.billRef.endsWith("-SEED") &&
      o.total > 0,
  );
}

export type OrderChannelLabel =
  | "Dine-in"
  | "Takeaway"
  | "Delivery"
  | "Online Orders"
  | "Foodpanda Orders"
  | "Staff Food";

export function billChannelLabel(tableLabel: string): OrderChannelLabel {
  const label = tableLabel.trim().toLowerCase();
  if (label.includes("staff food") || label.includes("staff-food") || label.startsWith("sf-")) {
    return "Staff Food";
  }
  if (label.includes("foodpanda") || label.startsWith("fp-")) return "Foodpanda Orders";
  if (label.includes("online") || label.startsWith("ol-")) return "Online Orders";
  if (label === "delivery" || label.startsWith("dl-")) return "Delivery";
  if (label.includes("takeaway") || label.startsWith("tw-")) return "Takeaway";
  return "Dine-in";
}

export type OrderSalesMetrics = {
  todayAmountPkr: number;
  yesterdayAmountPkr: number;
  allCompletedAmountPkr: number;
  changePercent: number;
  orderCount: number;
  todayOrderCount: number;
  recentSales: { time: string; type: string; ref: string; amount: number }[];
};

export function salesMetricsFromOrders(orders: Bill[]): OrderSalesMetrics {
  const completed = payableCompletedOrders(orders);
  const todayKey = currentBusinessDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const todayOrders = completed.filter((o) => karachiDateKey(o.createdAt) === todayKey);
  const yesterdayOrders = completed.filter((o) => karachiDateKey(o.createdAt) === yesterdayKey);

  const todayAmountPkr = todayOrders.reduce((s, o) => s + o.total, 0);
  const yesterdayAmountPkr = yesterdayOrders.reduce((s, o) => s + o.total, 0);
  const allCompletedAmountPkr = completed.reduce((s, o) => s + o.total, 0);
  const changePercent =
    yesterdayAmountPkr > 0
      ? Math.round(((todayAmountPkr - yesterdayAmountPkr) / yesterdayAmountPkr) * 100)
      : 0;

  const recentSales = [...completed]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12)
    .map((order) => ({
      time: karachiTime(order.createdAt),
      type: billChannelLabel(order.tableLabel),
      ref: order.orderRef ?? order.billRef,
      amount: order.total,
    }));

  return {
    todayAmountPkr,
    yesterdayAmountPkr,
    allCompletedAmountPkr,
    changePercent,
    orderCount: completed.length,
    todayOrderCount: todayOrders.length,
    recentSales,
  };
}

export type ChannelSales = { label: OrderChannelLabel; amount: number; count: number };

export function channelSalesFromOrders(orders: Bill[]): ChannelSales[] {
  const completed = payableCompletedOrders(orders);
  const channels: OrderChannelLabel[] = [
    "Dine-in",
    "Takeaway",
    "Delivery",
    "Online Orders",
    "Foodpanda Orders",
    "Staff Food",
  ];
  return channels
    .map((label) => {
      const rows = completed.filter((o) => billChannelLabel(o.tableLabel) === label);
      return {
        label,
        amount: rows.reduce((s, o) => s + o.total, 0),
        count: rows.length,
      };
    })
    .filter((c) => c.count > 0);
}

export type TopProduct = { label: string; qty: number; revenue: number };

export function topProductsFromOrders(orders: Bill[], limit = 20): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const order of payableCompletedOrders(orders)) {
    for (const line of order.lines ?? []) {
      const label = line.label?.trim() || "Item";
      const existing = map.get(label) ?? { label, qty: 0, revenue: 0 };
      existing.qty += line.qty;
      existing.revenue += line.unitPrice * line.qty;
      map.set(label, existing);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function filterOrdersByDate(orders: Bill[], dateKey: string | null): Bill[] {
  if (!dateKey) return payableCompletedOrders(orders);
  return payableCompletedOrders(orders).filter((o) => karachiDateKey(o.createdAt) === dateKey);
}

/** Inclusive date-to-date filter (YYYY-MM-DD, Asia/Karachi calendar days). */
export function filterOrdersByDateRange(
  orders: Bill[],
  fromKey: string,
  toKey: string,
): Bill[] {
  const from = fromKey <= toKey ? fromKey : toKey;
  const to = fromKey <= toKey ? toKey : fromKey;
  return payableCompletedOrders(orders).filter((o) => {
    const key = karachiDateKey(o.createdAt);
    return key >= from && key <= to;
  });
}

export type ChargesReport = {
  salesTotal: number;
  serviceCharges: number;
  deliveryCharges: number;
  tax: number;
  discount: number;
  orderCount: number;
  netAfterDiscount: number;
};

export function chargesReportFromOrders(orders: Bill[]): ChargesReport {
  const completed = payableCompletedOrders(orders);
  const salesTotal = completed.reduce((s, o) => s + o.total, 0);
  const serviceCharges = completed.reduce((s, o) => s + (o.service ?? 0), 0);
  const deliveryCharges = completed.reduce((s, o) => s + (o.deliveryChargePkr ?? 0), 0);
  const tax = completed.reduce((s, o) => s + (o.tax ?? 0), 0);
  const discount = completed.reduce((s, o) => s + (o.discount ?? 0), 0);
  return {
    salesTotal,
    serviceCharges,
    deliveryCharges,
    tax,
    discount,
    orderCount: completed.length,
    netAfterDiscount: completed.reduce((s, o) => s + Math.max(0, o.subtotal - (o.discount ?? 0)), 0),
  };
}

/** Owner / admin home: sales mix + cash vs card tax for a bill set (usually today). */
export type OwnerDashboardMetrics = {
  totalSales: number;
  totalDiscount: number;
  totalServiceCharges: number;
  totalDeliveryCharges: number;
  cashPayments: number;
  cardPayments: number;
  cashTaxCollected: number;
  cardTaxCollected: number;
  orderCount: number;
  otherPayments: number;
};

export function ownerDashboardFromOrders(orders: Bill[]): OwnerDashboardMetrics {
  const completed = payableCompletedOrders(orders);
  let totalSales = 0;
  let totalDiscount = 0;
  let totalServiceCharges = 0;
  let totalDeliveryCharges = 0;
  let cashPayments = 0;
  let cardPayments = 0;
  let otherPayments = 0;
  let cashTaxCollected = 0;
  let cardTaxCollected = 0;

  for (const bill of completed) {
    totalSales += bill.total ?? 0;
    totalDiscount += bill.discount ?? 0;
    totalServiceCharges += bill.service ?? 0;
    totalDeliveryCharges += bill.deliveryChargePkr ?? 0;

    let billCash = 0;
    let billCard = 0;
    let billOther = 0;
    for (const p of bill.payments ?? []) {
      const amount = Math.max(0, Math.round(Number(p.amount ?? 0)));
      if (p.method === "cash") billCash += amount;
      else if (p.method === "card") billCard += amount;
      else billOther += amount;
    }
    // Legacy bills with no payment lines — treat whole total as cash.
    if (billCash + billCard + billOther === 0 && (bill.total ?? 0) > 0) {
      billCash = bill.total ?? 0;
    }

    cashPayments += billCash;
    cardPayments += billCard;
    otherPayments += billOther;

    const tax = Math.max(0, bill.tax ?? 0);
    const paidMix = billCash + billCard;
    if (tax > 0 && paidMix > 0) {
      cashTaxCollected += Math.round((tax * billCash) / paidMix);
      cardTaxCollected += Math.round((tax * billCard) / paidMix);
    } else if (tax > 0 && billCash > 0) {
      cashTaxCollected += tax;
    } else if (tax > 0 && billCard > 0) {
      cardTaxCollected += tax;
    } else if (tax > 0) {
      cashTaxCollected += tax;
    }
  }

  return {
    totalSales,
    totalDiscount,
    totalServiceCharges,
    totalDeliveryCharges,
    cashPayments,
    cardPayments,
    cashTaxCollected,
    cardTaxCollected,
    orderCount: completed.length,
    otherPayments,
  };
}

export type DiscountRow = {
  ref: string;
  time: string;
  channel: string;
  subtotal: number;
  discount: number;
};

export function discountRowsFromOrders(orders: Bill[]): { total: number; rows: DiscountRow[] } {
  const withDisc = payableCompletedOrders(orders)
    .filter((o) => (o.discount ?? 0) > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    total: withDisc.reduce((s, o) => s + o.discount, 0),
    rows: withDisc.map((o) => ({
      ref: o.orderRef ?? o.billRef,
      time: `${karachiDateKey(o.createdAt)} ${karachiTime(o.createdAt)}`,
      channel: billChannelLabel(o.tableLabel),
      subtotal: o.subtotal,
      discount: o.discount,
    })),
  };
}
