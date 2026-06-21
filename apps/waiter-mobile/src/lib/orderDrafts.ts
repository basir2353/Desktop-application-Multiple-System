import type { MenuItem } from "@platform/contracts";

export type CartLine = { item: MenuItem; qty: number };

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
