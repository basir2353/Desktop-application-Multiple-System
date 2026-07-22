export type BillReceiptLayout = "standard" | "compact";
export type BillHeaderAlign = "center" | "left";

/** Legacy placement hint — new layouts prefer `blockOrder`. */
export type BillCustomLineZone = "header" | "beforeItems" | "afterItems" | "footer";

export type BillCustomLine = {
  id: string;
  text: string;
  bold: boolean;
  zone: BillCustomLineZone;
  enabled: boolean;
  /** Absolute px; 0 = inherit from base receipt scale. */
  fontSize: number;
};

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

/** Built-in receipt sections that can be reordered on the canvas. */
export const BILL_SYSTEM_BLOCKS = [
  "branchName",
  "headerSubtitle",
  "documentTitle",
  "meta",
  "notes",
  "timestamp",
  "items",
  "totals",
  "footer",
  "footerSecondary",
] as const;

export type BillSystemBlockId = (typeof BILL_SYSTEM_BLOCKS)[number];

export type BillBlockStyle = {
  bold: boolean;
  /** 0 = use default scaled size for that block. */
  fontSize: number;
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
  /** Extra editable lines — drag/reorder, bold, size. */
  customLines: BillCustomLine[];
  /** Print order: system block ids + custom line ids. */
  blockOrder: string[];
  /** Per-block bold / font size (system blocks). Custom lines store style on themselves. */
  blockStyles: Record<string, BillBlockStyle>;
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

export const DEFAULT_BILL_BLOCK_ORDER: string[] = [...BILL_SYSTEM_BLOCKS];

export const BILL_SYSTEM_BLOCK_LABELS: Record<BillSystemBlockId, string> = {
  branchName: "Business name",
  headerSubtitle: "Subtitle",
  documentTitle: "Document title",
  meta: "Order details",
  notes: "Notes",
  timestamp: "Date & branch",
  items: "Items table",
  totals: "Totals",
  footer: "Footer message",
  footerSecondary: "Footer secondary",
};

export const DEFAULT_BILL_PRINT_SETTINGS: BillPrintSettings = {
  baseFontSize: 14,
  layout: "standard",
  headerAlign: "center",
  headerBusinessName: "",
  headerSubtitle: "",
  documentTitle: "Tax Invoice",
  footerText: "Thank you — visit again",
  footerSecondaryText: "",
  fields: DEFAULT_BILL_RECEIPT_FIELDS,
  customLines: [],
  blockOrder: [...DEFAULT_BILL_BLOCK_ORDER],
  blockStyles: {},
};

export const BILL_CUSTOM_LINE_ZONE_LABELS: Record<BillCustomLineZone, string> = {
  header: "After header",
  beforeItems: "Before items",
  afterItems: "After items",
  footer: "In footer",
};

export const BILL_LINE_FONT_MIN = 10;
export const BILL_LINE_FONT_MAX = 28;

export function newBillCustomLine(
  partial?: Partial<Omit<BillCustomLine, "id">> & { id?: string },
): BillCustomLine {
  return {
    id: partial?.id ?? `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: partial?.text ?? "New line",
    bold: partial?.bold ?? false,
    zone: partial?.zone ?? "footer",
    enabled: partial?.enabled ?? true,
    fontSize: clampLineFont(partial?.fontSize ?? 0),
  };
}

export function isBillSystemBlock(id: string): id is BillSystemBlockId {
  return (BILL_SYSTEM_BLOCKS as readonly string[]).includes(id);
}

/** Enabled custom lines for a print zone (legacy zone helpers). */
export function customLinesForZone(
  settings: BillPrintSettings | null | undefined,
  zone: BillCustomLineZone,
): BillCustomLine[] {
  return (settings?.customLines ?? []).filter(
    (line) => line.enabled && line.zone === zone && line.text.trim().length > 0,
  );
}

export function getBlockStyle(
  settings: BillPrintSettings,
  blockId: string,
): BillBlockStyle {
  const raw = settings.blockStyles?.[blockId];
  return {
    bold: Boolean(raw?.bold),
    fontSize: clampLineFont(raw?.fontSize ?? 0),
  };
}

export function resolveBlockFontSize(
  settings: BillPrintSettings,
  blockId: string,
  fallbackPx: number,
): number {
  const custom = settings.customLines.find((line) => line.id === blockId);
  if (custom) {
    return custom.fontSize > 0 ? custom.fontSize : fallbackPx;
  }
  const style = getBlockStyle(settings, blockId);
  return style.fontSize > 0 ? style.fontSize : fallbackPx;
}

export const BILL_PRINT_SETTINGS_CHANGED_EVENT = "pops-bill-print-settings-changed";

const STORAGE_KEY = "pops-bill-print-settings-v2";
const ACTIVE_TEMPLATE_KEY = "pops-bill-print-active-template-v1";

export const BILL_FONT_SIZE_MIN = 12;
export const BILL_FONT_SIZE_MAX = 20;

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

function clampLineFont(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(BILL_LINE_FONT_MIN, Math.min(BILL_LINE_FONT_MAX, Math.round(value)));
}

function normalizeFields(input: Partial<BillReceiptFields> | undefined): BillReceiptFields {
  return { ...DEFAULT_BILL_RECEIPT_FIELDS, ...input };
}

function normalizeCustomLines(input: unknown): BillCustomLine[] {
  if (!Array.isArray(input)) return [];
  const zones: BillCustomLineZone[] = ["header", "beforeItems", "afterItems", "footer"];
  return input
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<BillCustomLine>;
      const zone = zones.includes(row.zone as BillCustomLineZone)
        ? (row.zone as BillCustomLineZone)
        : "footer";
      const text = String(row.text ?? "").slice(0, 120);
      return {
        id: String(row.id ?? `line-${index}`),
        text,
        bold: Boolean(row.bold),
        zone,
        enabled: row.enabled !== false,
        fontSize: clampLineFont(Number(row.fontSize ?? 0)),
      } satisfies BillCustomLine;
    })
    .filter((line): line is BillCustomLine => Boolean(line))
    .slice(0, 24);
}

function zoneInsertIndex(order: string[], zone: BillCustomLineZone): number {
  if (zone === "header") {
    const i = order.indexOf("documentTitle");
    return i >= 0 ? i + 1 : 0;
  }
  if (zone === "beforeItems") {
    const i = order.indexOf("items");
    return i >= 0 ? i : order.length;
  }
  if (zone === "afterItems") {
    const i = order.indexOf("totals");
    return i >= 0 ? i : order.length;
  }
  const i = order.indexOf("footerSecondary");
  return i >= 0 ? i + 1 : order.length;
}

/** Merge system blocks + custom line ids into a stable print order. */
export function normalizeBlockOrder(
  orderInput: unknown,
  customLines: BillCustomLine[],
): string[] {
  const customIds = new Set(customLines.map((line) => line.id));
  const seen = new Set<string>();
  const order: string[] = [];

  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    if (!isBillSystemBlock(id) && !customIds.has(id)) return;
    seen.add(id);
    order.push(id);
  };

  if (Array.isArray(orderInput)) {
    for (const raw of orderInput) push(String(raw));
  }

  for (const id of BILL_SYSTEM_BLOCKS) {
    if (!seen.has(id)) {
      const defIndex = DEFAULT_BILL_BLOCK_ORDER.indexOf(id);
      let insertAt = order.length;
      for (let i = defIndex + 1; i < DEFAULT_BILL_BLOCK_ORDER.length; i++) {
        const nextId = DEFAULT_BILL_BLOCK_ORDER[i];
        const found = order.indexOf(nextId);
        if (found >= 0) {
          insertAt = found;
          break;
        }
      }
      order.splice(insertAt, 0, id);
      seen.add(id);
    }
  }

  for (const line of customLines) {
    if (!seen.has(line.id)) {
      const at = zoneInsertIndex(order, line.zone);
      order.splice(at, 0, line.id);
      seen.add(line.id);
    }
  }

  return order;
}

function normalizeBlockStyles(input: unknown): Record<string, BillBlockStyle> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, BillBlockStyle> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<BillBlockStyle>;
    out[key] = {
      bold: Boolean(row.bold),
      fontSize: clampLineFont(Number(row.fontSize ?? 0)),
    };
  }
  return out;
}

function migrateLegacy(raw: unknown): Partial<BillPrintSettings> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if ("fields" in obj || "layout" in obj || "customLines" in obj || "blockOrder" in obj) {
    return obj as Partial<BillPrintSettings>;
  }
  if ("baseFontSize" in obj) return { baseFontSize: obj.baseFontSize as number };
  return {};
}

export function normalizeBillPrintSettings(input: Partial<BillPrintSettings>): BillPrintSettings {
  const layout = input.layout === "compact" ? "compact" : "standard";
  const headerAlign = input.headerAlign === "left" ? "left" : "center";
  const headerBusinessName = (input.headerBusinessName ?? "").trim().slice(0, 64);
  const headerSubtitle = (input.headerSubtitle ?? "").trim().slice(0, 80);
  const documentTitle =
    (input.documentTitle ?? DEFAULT_BILL_PRINT_SETTINGS.documentTitle).trim() ||
    DEFAULT_BILL_PRINT_SETTINGS.documentTitle;
  const footerText =
    (input.footerText ?? DEFAULT_BILL_PRINT_SETTINGS.footerText).trim() ||
    DEFAULT_BILL_PRINT_SETTINGS.footerText;
  const footerSecondaryText = (input.footerSecondaryText ?? "").trim().slice(0, 120);
  let baseFontSize = clampFontSize(input.baseFontSize ?? DEFAULT_BILL_PRINT_SETTINGS.baseFontSize);
  if (baseFontSize <= 12) baseFontSize = DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  const customLines = normalizeCustomLines(input.customLines);
  return {
    baseFontSize,
    layout,
    headerAlign,
    headerBusinessName,
    headerSubtitle,
    documentTitle: documentTitle.slice(0, 48),
    footerText: footerText.slice(0, 120),
    footerSecondaryText,
    fields: normalizeFields(input.fields),
    customLines,
    blockOrder: normalizeBlockOrder(input.blockOrder, customLines),
    blockStyles: normalizeBlockStyles(input.blockStyles),
  };
}

export function loadBillPrintSettings(branchCode: string | undefined): BillPrintSettings {
  if (!branchCode) return DEFAULT_BILL_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
      new CustomEvent(BILL_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
    );
  } catch {
    // ignore storage errors
  }
}

export function loadActiveBillTemplateId(branchCode: string | undefined): string | null {
  if (!branchCode || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[branchCode] || null;
  } catch {
    return null;
  }
}

export function saveActiveBillTemplateId(branchCode: string, templateId: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (templateId) parsed[branchCode] = templateId;
    else delete parsed[branchCode];
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/** Scale receipt typography relative to the default body size (readable on thermal). */
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
    branchName: px(20),
    docType: px(12),
    metaChip: px(13),
    metaChipBillRef: px(13),
    notes: px(12),
    timestamp: px(12),
    th: px(11),
    itemName: px(15),
    qty: px(15),
    amt: px(14),
    rowLabel: px(13),
    rowValue: px(14),
    grandLabel: px(16),
    grandValue: px(18),
    footer: px(12),
    headerSubtitle: px(11),
    footerSecondary: px(11),
  };
}
