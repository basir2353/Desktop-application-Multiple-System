<<<<<<< Updated upstream
export type BillReceiptLayout = "standard" | "compact";
export type BillHeaderAlign = "center" | "left";

export type BillReceiptFields = {
  branchName: boolean;
  headerSubtitle: boolean;
  documentTitle: boolean;
  orderRef: boolean;
  orderType: boolean;
  tableLabel: boolean;
  billRef: boolean;
  waiterName: boolean;
  printerName: boolean;
  notes: boolean;
  timestamp: boolean;
  branchCode: boolean;
  itemHeaders: boolean;
  itemQty: boolean;
  itemAmount: boolean;
  subtotal: boolean;
  discount: boolean;
  service: boolean;
  tax: boolean;
  delivery: boolean;
  total: boolean;
  footer: boolean;
  footerSecondary: boolean;
};

export type BillPrintSettings = {
  baseFontSize: number;
  layout: BillReceiptLayout;
  headerAlign: BillHeaderAlign;
  /** Overrides branch name on the receipt when set. */
  headerBusinessName: string;
  /** Optional tagline under the business name. */
  headerSubtitle: string;
  documentTitle: string;
  footerText: string;
  /** Optional second footer line (phone, address, NTN, etc.). */
  footerSecondaryText: string;
  fields: BillReceiptFields;
};

export const DEFAULT_BILL_RECEIPT_FIELDS: BillReceiptFields = {
  branchName: true,
  headerSubtitle: true,
  documentTitle: true,
  orderRef: true,
  orderType: true,
  tableLabel: true,
  billRef: true,
  waiterName: true,
  printerName: false,
  notes: true,
  timestamp: true,
  branchCode: true,
  itemHeaders: true,
  itemQty: true,
  itemAmount: true,
  subtotal: true,
  discount: true,
  service: true,
  tax: true,
  delivery: true,
  total: true,
  footer: true,
  footerSecondary: true,
};

export const DEFAULT_BILL_PRINT_SETTINGS: BillPrintSettings = {
  baseFontSize: 11,
  layout: "standard",
  headerAlign: "center",
  headerBusinessName: "",
  headerSubtitle: "",
  documentTitle: "Tax Invoice",
  footerText: "Thank you — visit again",
  footerSecondaryText: "",
  fields: DEFAULT_BILL_RECEIPT_FIELDS,
=======
export type BillPrintSettings = {
  /** Document title under the branch name (e.g. Tax Invoice). */
  documentTitle: string;
  /** Optional tagline under the branch name. */
  headerSubtitle: string;
  /** Footer message at the bottom of the receipt. */
  footerMessage: string;
  /** Show branch code next to the print timestamp. */
  showBranchCode: boolean;
  /** Show waiter name on the receipt. */
  showWaiterName: boolean;
  /** Show assigned printer name on the receipt. */
  showPrinterName: boolean;
  /** Show order notes when present. */
  showOrderNotes: boolean;
  /** Show printed-at timestamp. */
  showTimestamp: boolean;
  /** Show the amount column for each line item. */
  showItemPrices: boolean;
  /** Show the discount line when discount > 0. */
  showDiscountLine: boolean;
  /** Show the service charge line. */
  showServiceCharge: boolean;
  /** Show the tax line. */
  showTaxLine: boolean;
  /** Thermal paper width in millimetres. */
  paperWidthMm: 58 | 80;
  /** Base font size (px) for receipt body text. */
  baseFontSize: number;
};

export const DEFAULT_BILL_PRINT_SETTINGS: BillPrintSettings = {
  documentTitle: "Tax Invoice",
  headerSubtitle: "",
  footerMessage: "Thank you — visit again",
  showBranchCode: true,
  showWaiterName: true,
  showPrinterName: false,
  showOrderNotes: true,
  showTimestamp: true,
  showItemPrices: true,
  showDiscountLine: true,
  showServiceCharge: true,
  showTaxLine: true,
  paperWidthMm: 80,
  baseFontSize: 11,
>>>>>>> Stashed changes
};

export const BILL_PRINT_SETTINGS_CHANGED_EVENT = "pops-bill-print-settings-changed";

<<<<<<< Updated upstream
const STORAGE_KEY = "pops-bill-print-settings-v2";

export const BILL_FONT_SIZE_MIN = 9;
export const BILL_FONT_SIZE_MAX = 18;

export const BILL_FIELD_GROUPS: { label: string; keys: (keyof BillReceiptFields)[] }[] = [
  {
    label: "Header",
    keys: ["branchName", "headerSubtitle", "documentTitle"],
  },
  {
    label: "Order details",
    keys: ["orderRef", "orderType", "tableLabel", "billRef", "waiterName", "printerName", "notes"],
  },
  {
    label: "Footer meta",
    keys: ["timestamp", "branchCode"],
  },
  {
    label: "Line items",
    keys: ["itemHeaders", "itemQty", "itemAmount"],
  },
  {
    label: "Totals",
    keys: ["subtotal", "discount", "service", "tax", "delivery", "total"],
  },
  {
    label: "Closing",
    keys: ["footer", "footerSecondary"],
  },
];

export const BILL_FIELD_LABELS: Record<keyof BillReceiptFields, string> = {
  branchName: "Business name",
  headerSubtitle: "Header subtitle",
  documentTitle: "Document title",
  orderRef: "Order reference",
  orderType: "Order type",
  tableLabel: "Table / station",
  billRef: "Bill reference",
  waiterName: "Waiter",
  printerName: "Printer",
  notes: "Notes",
  timestamp: "Date & time",
  branchCode: "Branch code",
  itemHeaders: "Column headers",
  itemQty: "Quantity column",
  itemAmount: "Amount column",
  subtotal: "Subtotal",
  discount: "Discount",
  service: "Service charge",
  tax: "Tax",
  delivery: "Delivery",
  total: "Grand total",
  footer: "Footer message",
  footerSecondary: "Footer secondary line",
};

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  return Math.max(BILL_FONT_SIZE_MIN, Math.min(BILL_FONT_SIZE_MAX, Math.round(value)));
}

function normalizeFields(input: Partial<BillReceiptFields> | undefined): BillReceiptFields {
  return { ...DEFAULT_BILL_RECEIPT_FIELDS, ...input };
}

function migrateLegacy(raw: unknown): Partial<BillPrintSettings> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if ("fields" in obj || "layout" in obj) return obj as Partial<BillPrintSettings>;
  if ("baseFontSize" in obj) return { baseFontSize: obj.baseFontSize as number };
  return {};
}

export function normalizeBillPrintSettings(input: Partial<BillPrintSettings>): BillPrintSettings {
  const layout = input.layout === "compact" ? "compact" : "standard";
  const headerAlign = input.headerAlign === "left" ? "left" : "center";
  const headerBusinessName = (input.headerBusinessName ?? "").trim().slice(0, 64);
  const headerSubtitle = (input.headerSubtitle ?? "").trim().slice(0, 80);
  const documentTitle = (input.documentTitle ?? DEFAULT_BILL_PRINT_SETTINGS.documentTitle).trim()
    || DEFAULT_BILL_PRINT_SETTINGS.documentTitle;
  const footerText = (input.footerText ?? DEFAULT_BILL_PRINT_SETTINGS.footerText).trim()
    || DEFAULT_BILL_PRINT_SETTINGS.footerText;
  const footerSecondaryText = (input.footerSecondaryText ?? "").trim().slice(0, 120);
  return {
    baseFontSize: clampFontSize(input.baseFontSize ?? DEFAULT_BILL_PRINT_SETTINGS.baseFontSize),
    layout,
    headerAlign,
    headerBusinessName,
    headerSubtitle,
    documentTitle: documentTitle.slice(0, 48),
    footerText: footerText.slice(0, 120),
    footerSecondaryText,
    fields: normalizeFields(input.fields),
=======
const STORAGE_KEY = "pops-bill-print-settings-v1";

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  return Math.max(9, Math.min(14, Math.round(value)));
}

function clampPaperWidth(value: number): 58 | 80 {
  return value === 58 ? 58 : 80;
}

function trimText(value: string | undefined, max: number, fallback: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

export function normalizeBillPrintSettings(input: Partial<BillPrintSettings>): BillPrintSettings {
  return {
    documentTitle: trimText(input.documentTitle, 48, DEFAULT_BILL_PRINT_SETTINGS.documentTitle),
    headerSubtitle: (input.headerSubtitle ?? "").trim().slice(0, 80),
    footerMessage: trimText(input.footerMessage, 80, DEFAULT_BILL_PRINT_SETTINGS.footerMessage),
    showBranchCode: input.showBranchCode ?? DEFAULT_BILL_PRINT_SETTINGS.showBranchCode,
    showWaiterName: input.showWaiterName ?? DEFAULT_BILL_PRINT_SETTINGS.showWaiterName,
    showPrinterName: input.showPrinterName ?? DEFAULT_BILL_PRINT_SETTINGS.showPrinterName,
    showOrderNotes: input.showOrderNotes ?? DEFAULT_BILL_PRINT_SETTINGS.showOrderNotes,
    showTimestamp: input.showTimestamp ?? DEFAULT_BILL_PRINT_SETTINGS.showTimestamp,
    showItemPrices: input.showItemPrices ?? DEFAULT_BILL_PRINT_SETTINGS.showItemPrices,
    showDiscountLine: input.showDiscountLine ?? DEFAULT_BILL_PRINT_SETTINGS.showDiscountLine,
    showServiceCharge: input.showServiceCharge ?? DEFAULT_BILL_PRINT_SETTINGS.showServiceCharge,
    showTaxLine: input.showTaxLine ?? DEFAULT_BILL_PRINT_SETTINGS.showTaxLine,
    paperWidthMm: clampPaperWidth(input.paperWidthMm ?? DEFAULT_BILL_PRINT_SETTINGS.paperWidthMm),
    baseFontSize: clampFontSize(input.baseFontSize ?? DEFAULT_BILL_PRINT_SETTINGS.baseFontSize),
>>>>>>> Stashed changes
  };
}

export function loadBillPrintSettings(branchCode: string | undefined): BillPrintSettings {
  if (!branchCode) return DEFAULT_BILL_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
<<<<<<< Updated upstream
    if (!raw) {
      const legacyRaw = localStorage.getItem("pops-bill-print-settings-v1");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Record<string, Partial<BillPrintSettings>>;
        return normalizeBillPrintSettings(migrateLegacy(legacy[branchCode]));
      }
      return DEFAULT_BILL_PRINT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Record<string, Partial<BillPrintSettings>>;
    return normalizeBillPrintSettings(migrateLegacy(parsed[branchCode]));
=======
    if (!raw) return DEFAULT_BILL_PRINT_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<BillPrintSettings>>;
    return normalizeBillPrintSettings(parsed[branchCode] ?? DEFAULT_BILL_PRINT_SETTINGS);
>>>>>>> Stashed changes
  } catch {
    return DEFAULT_BILL_PRINT_SETTINGS;
  }
}

export function saveBillPrintSettings(branchCode: string, settings: BillPrintSettings): void {
  const next = normalizeBillPrintSettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, BillPrintSettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
<<<<<<< Updated upstream
      new CustomEvent(BILL_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
=======
      new CustomEvent(BILL_PRINT_SETTINGS_CHANGED_EVENT, {
        detail: { branchCode, settings: next },
      }),
>>>>>>> Stashed changes
    );
  } catch {
    // ignore storage errors
  }
}
<<<<<<< Updated upstream

/** Scale receipt typography relative to the default 11px body size. */
export function billReceiptFontSizes(baseFontSize: number): {
  body: number;
  branchName: number;
  docType: number;
  metaChip: number;
  metaChipBillRef: number;
  notes: number;
  timestamp: number;
  th: number;
  itemName: number;
  qty: number;
  amt: number;
  rowLabel: number;
  rowValue: number;
  grandLabel: number;
  grandValue: number;
  footer: number;
  headerSubtitle: number;
  footerSecondary: number;
} {
  const r = baseFontSize / DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  const px = (n: number) => Math.round(n * r * 10) / 10;
  return {
    body: baseFontSize,
    branchName: px(15),
    docType: px(9),
    metaChip: px(9.5),
    metaChipBillRef: px(9.5),
    notes: px(9.5),
    timestamp: px(9),
    th: px(8.5),
    itemName: px(10.5),
    qty: px(10),
    amt: px(10),
    rowLabel: px(9.5),
    rowValue: px(10),
    grandLabel: px(12),
    grandValue: px(13),
    footer: px(9),
    headerSubtitle: px(8.5),
    footerSecondary: px(8),
  };
}
=======
>>>>>>> Stashed changes
