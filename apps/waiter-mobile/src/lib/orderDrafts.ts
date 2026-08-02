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
  return `ORD-${Date.now().toString().slice(-4)}`;
}

export function matchesTable(stationLabel: string, tableId: string): boolean {
  const label = stationLabel.trim().toLowerCase();
  const t = tableId.toLowerCase();
  return label === t || label === `table ${t}` || label.endsWith(` ${t}`);
}
