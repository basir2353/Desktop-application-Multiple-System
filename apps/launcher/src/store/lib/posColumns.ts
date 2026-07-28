export type PosColumnId =
  | "itemNo"
  | "itemName"
  | "qty"
  | "price"
  | "extPrice"
  | "availQty"
  | "cost"
  | "margin"
  | "marginPct"
  | "markupPct"
  | "originalPrice"
  | "regularPrice"
  | "boxNo";

export type PosColumnDef = {
  id: PosColumnId;
  label: string;
  editable?: boolean;
  defaultVisible: boolean;
  /** Hide on small screens by default */
  mobileHide?: boolean;
};

export const POS_COLUMNS: PosColumnDef[] = [
  { id: "itemNo", label: "Item #", defaultVisible: true },
  { id: "boxNo", label: "Box #", defaultVisible: true, mobileHide: true },
  { id: "itemName", label: "Item Name", defaultVisible: true },
  { id: "qty", label: "Qty", editable: true, defaultVisible: true },
  { id: "price", label: "Price", editable: true, defaultVisible: true },
  { id: "extPrice", label: "Ext Price", defaultVisible: true },
  { id: "availQty", label: "Avail Qty", defaultVisible: true },
  { id: "cost", label: "Cost", defaultVisible: true, mobileHide: true },
  { id: "margin", label: "Margin", defaultVisible: true, mobileHide: true },
  { id: "marginPct", label: "Margin %", defaultVisible: true, mobileHide: true },
  { id: "markupPct", label: "Markup %", defaultVisible: true, mobileHide: true },
  { id: "originalPrice", label: "Original Price", defaultVisible: true, mobileHide: true },
  { id: "regularPrice", label: "Regular Price", defaultVisible: true, mobileHide: true },
];

const STORAGE_KEY = "store-pos-visible-columns-v2";

export function defaultVisibleColumns(): Record<PosColumnId, boolean> {
  return Object.fromEntries(POS_COLUMNS.map((c) => [c.id, c.defaultVisible])) as Record<
    PosColumnId,
    boolean
  >;
}

export function loadVisibleColumns(): Record<PosColumnId, boolean> {
  const base = defaultVisibleColumns();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<PosColumnId, boolean>>;
    for (const col of POS_COLUMNS) {
      if (typeof parsed[col.id] === "boolean") base[col.id] = parsed[col.id]!;
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function saveVisibleColumns(cols: Record<PosColumnId, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}
