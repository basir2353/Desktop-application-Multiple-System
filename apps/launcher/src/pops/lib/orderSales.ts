import type { Bill } from "@platform/contracts";
import {
  DEFAULT_BUSINESS_DAY,
  type BusinessDaySettings,
} from "./businessDay";

/** Completed and held bills shown on Orders (excludes void / seed). */
export function ordersPageBills(orders: Bill[]): Bill[] {
  return orders.filter(
    (o) => (o.status === "completed" || o.status === "held") && !o.billRef.endsWith("-SEED"),
  );
}

/** Completed bills with revenue — used for dashboard sales charts only. */
export function payableCompletedOrders(orders: Bill[]): Bill[] {
  return ordersPageBills(orders).filter((o) => o.total > 0);
}

/** @alias ordersPageBills */
export const completedOrdersFromApi = ordersPageBills;

const KARACHI_TZ = "Asia/Karachi";

export function karachiDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function karachiYear(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
  }).format(new Date(iso));
}

/** 24h "HH:mm" in Asia/Karachi */
export function karachiTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

/** Assign an order timestamp to a business date (YYYY-MM-DD). */
export function businessDateKey(
  iso: string | Date,
  settings: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): string {
  const calKey = karachiDateKey(iso);
  const mins = timeToMinutes(karachiTime(typeof iso === "string" ? iso : iso.toISOString()));
  const start = timeToMinutes(settings.dayStart);
  const end = timeToMinutes(settings.dayEnd);

  if (start === 0 && end >= 23 * 60 + 59) {
    return calKey;
  }

  if (end > start) {
    if (mins < start) return shiftDateKey(calKey, -1);
    if (mins > end) return shiftDateKey(calKey, 1);
    return calKey;
  }

  if (end === start) {
    if (mins < start) return shiftDateKey(calKey, -1);
    return calKey;
  }

  if (mins >= start) return calKey;
  if (mins <= end) return shiftDateKey(calKey, -1);
  return shiftDateKey(calKey, -1);
}

export function currentBusinessDateKey(settings: BusinessDaySettings = DEFAULT_BUSINESS_DAY): string {
  return businessDateKey(new Date(), settings);
}

export type OrderDateFilters = {
  year: string;
  date: string;
  timeFrom: string;
  timeTo: string;
};

/** Filter completed bills by completion date/time (Asia/Karachi). */
export function filterOrdersByDateTime(
  orders: Bill[],
  filters: OrderDateFilters,
  businessDay: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): Bill[] {
  return orders.filter((order) => {
    if (filters.year && filters.year !== "all" && karachiYear(order.createdAt) !== filters.year) {
      return false;
    }
    if (filters.date && businessDateKey(order.createdAt, businessDay) !== filters.date) {
      return false;
    }
    if (filters.timeFrom || filters.timeTo) {
      const mins = timeToMinutes(karachiTime(order.createdAt));
      if (filters.timeFrom && mins < timeToMinutes(filters.timeFrom)) return false;
      if (filters.timeTo && mins > timeToMinutes(filters.timeTo)) return false;
    }
    return true;
  });
}

function sumTotals(orders: Bill[]): number {
  return orders.reduce((sum, o) => sum + o.total, 0);
}

export function billChannelLabel(tableLabel: string): "Dine-in" | "Takeaway" | "Delivery" {
  const label = tableLabel.trim().toLowerCase();
  if (label === "delivery" || label.startsWith("dl-")) return "Delivery";
  if (label.includes("takeaway") || label.startsWith("tw-")) return "Takeaway";
  return "Dine-in";
}

function formatSaleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type SalesTrendPoint = {
  label: string;
  dateKey: string;
  amount: number;
};

/** Last N business days of completed-order sales. */
export function salesTrendFromOrders(
  orders: Bill[],
  days = 7,
  businessDay: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): SalesTrendPoint[] {
  const completed = payableCompletedOrders(orders);
  const points: SalesTrendPoint[] = [];
  const todayKey = currentBusinessDateKey(businessDay);

  for (let i = days - 1; i >= 0; i--) {
    const dateKey = shiftDateKey(todayKey, -i);
    const label = new Intl.DateTimeFormat("en-PK", {
      timeZone: KARACHI_TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${dateKey}T12:00:00Z`));
    const amount = completed
      .filter((o) => businessDateKey(o.createdAt, businessDay) === dateKey)
      .reduce((sum, o) => sum + o.total, 0);
    points.push({ label, dateKey, amount });
  }

  return points;
}

export type ChartSegment = {
  label: string;
  value: number;
  color: string;
};

export const CHANNEL_COLORS: Record<"Dine-in" | "Takeaway" | "Delivery", string> = {
  "Dine-in": "rgb(52 211 153)",
  Takeaway: "rgb(56 189 248)",
  Delivery: "rgb(167 139 250)",
};

/** Revenue split by service channel (completed orders). */
export function channelSalesFromOrders(orders: Bill[]): ChartSegment[] {
  const completed = payableCompletedOrders(orders);
  return (["Dine-in", "Takeaway", "Delivery"] as const).map((label) => ({
    label,
    value: completed
      .filter((o) => billChannelLabel(o.tableLabel) === label)
      .reduce((sum, o) => sum + o.total, 0),
    color: CHANNEL_COLORS[label],
  }));
}

/** Completed order count per business day (last N days). */
export function orderVolumeTrendFromOrders(
  orders: Bill[],
  days = 7,
  businessDay: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): SalesTrendPoint[] {
  const completed = payableCompletedOrders(orders);
  const points: SalesTrendPoint[] = [];
  const todayKey = currentBusinessDateKey(businessDay);

  for (let i = days - 1; i >= 0; i--) {
    const dateKey = shiftDateKey(todayKey, -i);
    const label = new Intl.DateTimeFormat("en-PK", {
      timeZone: KARACHI_TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${dateKey}T12:00:00Z`));
    const amount = completed.filter((o) => businessDateKey(o.createdAt, businessDay) === dateKey).length;
    points.push({ label, dateKey, amount });
  }

  return points;
}

export type OrderSalesMetrics = {
  todayAmountPkr: number;
  yesterdayAmountPkr: number;
  allCompletedAmountPkr: number;
  changePercent: number;
  orderCount: number;
  recentSales: { time: string; type: string; ref: string; amount: number; payment: string }[];
};

/** Dashboard sales derived from the same completed orders as POS → Orders. */
export function salesMetricsFromOrders(
  orders: Bill[],
  businessDay: BusinessDaySettings = DEFAULT_BUSINESS_DAY,
): OrderSalesMetrics {
  const completed = payableCompletedOrders(orders);
  const todayKey = currentBusinessDateKey(businessDay);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const todayOrders = completed.filter((o) => businessDateKey(o.createdAt, businessDay) === todayKey);
  const yesterdayOrders = completed.filter(
    (o) => businessDateKey(o.createdAt, businessDay) === yesterdayKey,
  );

  const todayAmountPkr = sumTotals(todayOrders);
  const yesterdayAmountPkr = sumTotals(yesterdayOrders);
  const allCompletedAmountPkr = sumTotals(completed);
  const changePercent =
    yesterdayAmountPkr > 0
      ? Math.round(((todayAmountPkr - yesterdayAmountPkr) / yesterdayAmountPkr) * 100)
      : 0;

  const recentSales = [...completed]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map((order) => ({
      time: formatSaleTime(order.createdAt),
      type: billChannelLabel(order.tableLabel),
      ref: order.orderRef ?? order.billRef,
      amount: order.total,
      payment: "Paid",
    }));

  return {
    todayAmountPkr,
    yesterdayAmountPkr,
    allCompletedAmountPkr,
    changePercent,
    orderCount: completed.length,
    recentSales,
  };
}
