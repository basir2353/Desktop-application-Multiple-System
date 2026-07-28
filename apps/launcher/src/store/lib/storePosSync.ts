import type { StoreProduct, StoreSale, CreateStoreSale } from "@platform/contracts";
import { createOfflineQueue, type OfflineQueueEntry } from "@platform/connectivity";

const DISPLAY_CHANNEL = "store-pos-customer-display";
const OFFLINE_QUEUE_KEY = "store-pos-offline-queue";

const offlineSales = createOfflineQueue<CreateStoreSale>(OFFLINE_QUEUE_KEY);

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

export type OfflineSaleEntry = OfflineQueueEntry<CreateStoreSale>;

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
  return offlineSales.enqueue(payload);
}

export function loadOfflineQueue(): OfflineSaleEntry[] {
  return offlineSales.load();
}

export function removeOfflineSale(id: string): void {
  offlineSales.remove(id);
}

export function bumpOfflineAttempt(id: string): void {
  offlineSales.markAttempt(id);
}

export type StorePriceLevel = "regular" | "sale" | "wholesale" | "custom" | "market_sale";

export type CartLine = {
  product: StoreProduct;
  qty: number;
  qtyGrams?: number;
  priceLevel?: StorePriceLevel;
  /** Manual rate override on the POS sale screen (editable Price/Rate). */
  unitPriceOverride?: number;
  /** Sale-only display name — does not update product master. */
  displayName?: string;
  displayDescription?: string;
  lineDiscountAmount?: number;
  lineDiscountPct?: number;
  discountName?: string;
};

export function productMatchesCode(product: StoreProduct, code: string): boolean {
  const q = code.trim();
  if (!q) return false;
  if (product.sku === q || product.barcode === q) return true;
  return (product.barcodes ?? []).some((b) => b === q);
}

export function priceForLevel(product: StoreProduct, level: StorePriceLevel = "regular"): number {
  switch (level) {
    case "sale":
      return product.salePrice > 0 ? product.salePrice : product.sellingPrice;
    case "wholesale":
      return product.wholesalePrice > 0 ? product.wholesalePrice : product.sellingPrice;
    case "custom":
      return product.customPrice > 0 ? product.customPrice : product.sellingPrice;
    case "market_sale":
      return product.marketSalePrice > 0 ? product.marketSalePrice : product.sellingPrice;
    default:
      return product.sellingPrice;
  }
}

export function availablePriceLevels(product: StoreProduct): Array<{ id: StorePriceLevel; label: string; price: number }> {
  const levels: Array<{ id: StorePriceLevel; label: string; price: number }> = [
    { id: "regular", label: "Regular", price: product.sellingPrice },
  ];
  if (product.salePrice > 0) levels.push({ id: "sale", label: "Sale", price: product.salePrice });
  if (product.wholesalePrice > 0) levels.push({ id: "wholesale", label: "Wholesale", price: product.wholesalePrice });
  if (product.customPrice > 0) levels.push({ id: "custom", label: "Custom", price: product.customPrice });
  if (product.marketSalePrice > 0) levels.push({ id: "market_sale", label: "Employee", price: product.marketSalePrice });
  return levels;
}

export function cartLineQtyLabel(line: CartLine): string {
  if (line.product.isWeighed) {
    const grams = line.qtyGrams ?? Math.round(line.qty * 1000);
    return `${(grams / 1000).toFixed(3)} kg`;
  }
  return String(line.qty);
}

export function cartLineUnitPrice(line: CartLine): number {
  if (line.unitPriceOverride != null && Number.isFinite(line.unitPriceOverride)) {
    return Math.max(0, line.unitPriceOverride);
  }
  return priceForLevel(line.product, line.priceLevel ?? "regular");
}

/** Purchase / original cost shown as read-only on POS. */
export function cartLineOriginalPrice(line: CartLine): number {
  return line.product.purchasePrice ?? 0;
}

/** Catalog regular selling price (not the editable rate). */
export function cartLineRegularPrice(line: CartLine): number {
  return line.product.sellingPrice ?? 0;
}

export function cartLineCost(line: CartLine): number {
  return line.product.orderCost > 0 ? line.product.orderCost : line.product.purchasePrice;
}

/** Profit per unit (price − cost). */
export function cartLineMargin(line: CartLine): number {
  return cartLineUnitPrice(line) - cartLineCost(line);
}

/** (Price − Cost) / Price × 100 */
export function cartLineMarginPct(line: CartLine): number {
  const price = cartLineUnitPrice(line);
  if (price <= 0) return 0;
  return Math.round(((price - cartLineCost(line)) / price) * 1000) / 10;
}

/** (Price − Cost) / Cost × 100 */
export function cartLineMarkupPct(line: CartLine): number {
  const cost = cartLineCost(line);
  if (cost <= 0) return 0;
  return Math.round(((cartLineUnitPrice(line) - cost) / cost) * 1000) / 10;
}

/** Box / pack / size label for the receipt grid. */
export function cartLineBoxNo(line: CartLine): string {
  const size = (line.product.size ?? "").trim();
  if (size) return size;
  const unit = (line.product.unitName ?? "").trim();
  if (unit) return unit;
  return line.product.isWeighed ? "kg" : "—";
}

export function cartLineAvailLabel(line: CartLine): string {
  const p = line.product;
  if (p.isWeighed) return `${(p.availableStock / 1000).toFixed(3)} kg`;
  return String(p.availableStock);
}

export function cartLineDisplayName(line: CartLine): string {
  return line.displayName?.trim() || line.product.name;
}

export function cartLineGross(line: CartLine): number {
  const unit = cartLineUnitPrice(line);
  if (line.product.isWeighed) {
    const grams = line.qtyGrams ?? Math.round(line.qty * 1000);
    return Math.round((unit * grams) / 1000);
  }
  return unit * line.qty;
}

export function cartLineDiscount(line: CartLine): number {
  const gross = cartLineGross(line);
  if ((line.lineDiscountAmount ?? 0) > 0) return Math.min(gross, Math.round(line.lineDiscountAmount!));
  if ((line.lineDiscountPct ?? 0) > 0) return Math.min(gross, Math.round((gross * line.lineDiscountPct!) / 100));
  return 0;
}

export function cartLineTotal(line: CartLine): number {
  return Math.max(0, cartLineGross(line) - cartLineDiscount(line));
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
      name: cartLineDisplayName(l),
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

export { isOnline } from "@platform/connectivity";

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
