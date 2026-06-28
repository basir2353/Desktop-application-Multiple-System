import type { StoreProduct, StoreSale } from "@platform/contracts";
import type { CreateStoreSale } from "@platform/contracts";

const DISPLAY_CHANNEL = "store-pos-customer-display";
const OFFLINE_QUEUE_KEY = "store-pos-offline-queue";

export type CustomerDisplayState = {
  branchCode: string;
  branchName: string;
  lines: Array<{ name: string; qtyLabel: string; lineTotal: number }>;
  subtotal: number;
  tax: number;
  discount: number;
  promotionDiscount: number;
  total: number;
  promoMessage?: string;
};

export type OfflineSaleEntry = {
  id: string;
  payload: CreateStoreSale;
  createdAt: string;
  attempts: number;
};

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(DISPLAY_CHANNEL);
}

export function publishCustomerDisplay(state: CustomerDisplayState): void {
  const payload = JSON.stringify(state);
  localStorage.setItem(`${DISPLAY_CHANNEL}:${state.branchCode}`, payload);
  getChannel()?.postMessage(state);
}

export function subscribeCustomerDisplay(branchCode: string, onUpdate: (state: CustomerDisplayState | null) => void): () => void {
  function readStored(): void {
    const raw = localStorage.getItem(`${DISPLAY_CHANNEL}:${branchCode}`);
    if (!raw) {
      onUpdate(null);
      return;
    }
    try {
      onUpdate(JSON.parse(raw) as CustomerDisplayState);
    } catch {
      onUpdate(null);
    }
  }

  readStored();
  const channel = getChannel();
  const onMessage = (e: MessageEvent<CustomerDisplayState>) => {
    if (e.data?.branchCode === branchCode) onUpdate(e.data);
  };
  channel?.addEventListener("message", onMessage);
  const onStorage = (e: StorageEvent) => {
    if (e.key === `${DISPLAY_CHANNEL}:${branchCode}`) readStored();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}

export function enqueueOfflineSale(payload: CreateStoreSale): OfflineSaleEntry {
  const queue = loadOfflineQueue();
  const entry: OfflineSaleEntry = {
    id: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function loadOfflineQueue(): OfflineSaleEntry[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineSaleEntry[];
  } catch {
    return [];
  }
}

export function removeOfflineSale(id: string): void {
  const queue = loadOfflineQueue().filter((e) => e.id !== id);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function bumpOfflineAttempt(id: string): void {
  const queue = loadOfflineQueue().map((e) => (e.id === id ? { ...e, attempts: e.attempts + 1 } : e));
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export type CartLine = {
  product: StoreProduct;
  qty: number;
  qtyGrams?: number;
};

export function cartLineQtyLabel(line: CartLine): string {
  if (line.product.isWeighed) {
    const grams = line.qtyGrams ?? Math.round(line.qty * 1000);
    return `${(grams / 1000).toFixed(3)} kg`;
  }
  return String(line.qty);
}

export function cartLineTotal(line: CartLine): number {
  if (line.product.isWeighed) {
    const grams = line.qtyGrams ?? Math.round(line.qty * 1000);
    return Math.round((line.product.sellingPrice * grams) / 1000);
  }
  return line.product.sellingPrice * line.qty;
}

export function cartToDisplayState(
  branchCode: string,
  branchName: string,
  cart: CartLine[],
  subtotal: number,
  tax: number,
  discount: number,
  promotionDiscount: number,
  total: number,
): CustomerDisplayState {
  return {
    branchCode,
    branchName,
    lines: cart.map((l) => ({
      name: l.product.name,
      qtyLabel: cartLineQtyLabel(l),
      lineTotal: cartLineTotal(l),
    })),
    subtotal,
    tax,
    discount,
    promotionDiscount,
    total,
    promoMessage: "Thank you for shopping with us!",
  };
}

export function getTerminalId(): string {
  const key = "store-pos-terminal-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export type ScaleWeightEvent = { kg: number; at: string };

const SCALE_CHANNEL = "store-pos-scale";

export function publishScaleWeight(kg: number): void {
  const event: ScaleWeightEvent = { kg, at: new Date().toISOString() };
  localStorage.setItem(SCALE_CHANNEL, JSON.stringify(event));
  if (typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel(SCALE_CHANNEL);
    ch.postMessage({ type: "scale", ...event });
    ch.close();
  }
}

export function subscribeScaleWeight(onWeight: (kg: number) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(SCALE_CHANNEL);
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "scale" && typeof e.data.kg === "number") onWeight(e.data.kg);
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}

export function printSaleSuccess(sale: StoreSale): void {
  void sale;
}
