import type { MenuItem, MenuItemVariant } from "@platform/contracts";

export type CartLine = {
  key: string;
  item: MenuItem;
  variant: MenuItemVariant | null;
  qty: number;
  unitPrice: number;
  lineLabel: string;
  /** Qty already sent/printed — cannot go below this. */
  printedQty?: number;
};

export type TableDraft = {
  cart: CartLine[];
  notes: string;
  orderRef: string;
};

export function newOrderRef(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  // Unique per device+moment — never ORD-#### (that reused paid order numbers).
  return `ORD-${y}${mo}${d}-${h}${mi}${s}${ms}-${rand}`;
}

export function matchesTable(stationLabel: string, tableId: string): boolean {
  const label = stationLabel.trim().toLowerCase();
  const t = tableId.toLowerCase();
  return label === t || label === `table ${t}` || label.endsWith(` ${t}`);
}
