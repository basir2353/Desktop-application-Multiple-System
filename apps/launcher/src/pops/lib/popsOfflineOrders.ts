import { createOfflineQueue, isOnline, type OfflineQueueEntry } from "@platform/connectivity";
import type { Bill, CreateBill, CreateKitchenTicket, KitchenTicket } from "@platform/contracts";

const BILL_QUEUE_KEY = "pops-offline-bills-v1";
const KOT_QUEUE_KEY = "pops-offline-kots-v1";
const FORCE_OPEN_KEY = "pops-force-orders-open-v1";

const billQueue = createOfflineQueue<CreateBill>(BILL_QUEUE_KEY);
const kotQueue = createOfflineQueue<CreateKitchenTicket>(KOT_QUEUE_KEY);

export type OfflineBillEntry = OfflineQueueEntry<CreateBill> & { materialised: Bill };
export type OfflineKotEntry = OfflineQueueEntry<CreateKitchenTicket> & { materialised: KitchenTicket };

export function isDayClosePauseError(message: string): boolean {
  return /paused for day closing|orders are paused|ask a manager to resume/i.test(message);
}

export function isTransientOrderError(message: string): boolean {
  return (
    isDayClosePauseError(message) ||
    /failed to fetch|networkerror|network request failed|offline|timeout|502|503|504/i.test(
      message,
    )
  );
}

/** Once day-close bricks POS, keep treating orders as open on this device. */
export function markOrdersForceOpen(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FORCE_OPEN_KEY, "1");
}

export function isOrdersForceOpen(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(FORCE_OPEN_KEY) === "1";
}

export function clearOrdersForceOpen(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(FORCE_OPEN_KEY);
}

function computeBillTotals(input: CreateBill): {
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
  servicePct: number;
  taxPct: number;
} {
  const subtotal = input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const servicePct = input.servicePct ?? 0;
  const taxPct = input.taxPct ?? 0;
  const discount =
    typeof input.discountPkr === "number"
      ? Math.min(input.discountPkr, subtotal)
      : Math.round((subtotal * (input.discountPct ?? 0)) / 100);
  const afterDiscount = Math.max(0, subtotal - discount);
  const service = Math.round((afterDiscount * servicePct) / 100);
  const tax = Math.round(((afterDiscount + service) * taxPct) / 100);
  const delivery = input.deliveryChargePkr ?? 0;
  const total = afterDiscount + service + tax + delivery;
  return { subtotal, discount, service, tax, total, servicePct, taxPct };
}

export function materialiseOfflineBill(input: CreateBill, id?: string): Bill {
  const totals = computeBillTotals(input);
  const now = new Date().toISOString();
  const billId = id ?? crypto.randomUUID();
  const refSeed = billId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return {
    id: billId,
    billRef: `OFF-${refSeed}`,
    orderRef: input.orderRef ?? `ORD-OFF-${refSeed}`,
    tableLabel: input.tableLabel,
    waiterId: input.waiterId ?? null,
    waiterName: input.waiterName ?? "POS Counter",
    lines: input.lines,
    notes: input.notes ?? null,
    subtotal: totals.subtotal,
    discount: totals.discount,
    service: totals.service,
    servicePct: totals.servicePct,
    tax: totals.tax,
    taxPct: totals.taxPct,
    total: totals.total,
    payments: input.payments ?? [],
    splitGroupRef: input.splitGroupRef ?? null,
    riderId: input.riderId ?? null,
    riderName: null,
    deliveryChargePkr: input.deliveryChargePkr ?? 0,
    status: input.status ?? "completed",
    createdAt: now,
  };
}

export function materialiseOfflineKot(input: CreateKitchenTicket, id?: string): KitchenTicket {
  const ticketId = id ?? crypto.randomUUID();
  const refSeed = ticketId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const itemsSummary = input.lines.map((l) => `${l.qty}× ${l.label}`).join(", ");
  return {
    id: ticketId,
    ticketRef: `KOFF-${refSeed}`,
    orderRef: input.orderRef ?? null,
    stationLabel: input.stationLabel,
    itemsSummary,
    lines: input.lines.map((l) => ({
      label: l.label,
      qty: l.qty,
      unitPrice: l.unitPrice ?? 0,
      menuItemId: l.menuItemId,
    })),
    notes: input.notes ?? null,
    priority: input.priority ?? "normal",
    status: "new",
    mins: 0,
    startedAt: null,
    createdAt: new Date().toISOString(),
    riderId: input.riderId ?? null,
    riderName: null,
    deliveryChargePkr: input.deliveryChargePkr ?? 0,
    deliveryStatus: null,
    createdById: null,
    createdByName: null,
  };
}

type StoredBill = OfflineQueueEntry<CreateBill> & { materialised: Bill };
type StoredKot = OfflineQueueEntry<CreateKitchenTicket> & { materialised: KitchenTicket };

function readBills(): StoredBill[] {
  return billQueue.load().map((e) => ({
    ...e,
    materialised: materialiseOfflineBill(e.payload, e.id),
  }));
}

function readKots(): StoredKot[] {
  return kotQueue.load().map((e) => ({
    ...e,
    materialised: materialiseOfflineKot(e.payload, e.id),
  }));
}

export function enqueueOfflineBill(input: CreateBill): Bill {
  markOrdersForceOpen();
  const entry = billQueue.enqueue(input);
  return materialiseOfflineBill(input, entry.id);
}

export function enqueueOfflineKot(input: CreateKitchenTicket): KitchenTicket {
  markOrdersForceOpen();
  const entry = kotQueue.enqueue(input);
  return materialiseOfflineKot(input, entry.id);
}

export function loadOfflineBills(): Bill[] {
  return readBills().map((e) => e.materialised);
}

export function loadOfflineKots(): KitchenTicket[] {
  return readKots().map((e) => e.materialised);
}

export function loadOfflineBillEntries(): StoredBill[] {
  return readBills();
}

export function loadOfflineKotEntries(): StoredKot[] {
  return readKots();
}

export function removeOfflineBill(id: string): void {
  billQueue.remove(id);
}

export function removeOfflineKot(id: string): void {
  kotQueue.remove(id);
}

export function bumpOfflineBillAttempt(id: string): void {
  billQueue.markAttempt(id);
}

export function bumpOfflineKotAttempt(id: string): void {
  kotQueue.markAttempt(id);
}

export function countOfflinePopsOrders(): number {
  return billQueue.size() + kotQueue.size();
}

export { isOnline };
