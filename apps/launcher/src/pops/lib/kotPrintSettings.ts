/** Kitchen ticket (KOT) customization — same idea as bill slip, without money columns. */

import {
  DEFAULT_BILL_BLOCK_ORDER,
  DEFAULT_BILL_RECEIPT_FIELDS,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";

export type KotHeaderAlign = "center" | "left";

export type KotCustomLineZone = "header" | "beforeItems" | "afterItems" | "footer";

export type KotCustomLine = {
  id: string;
  text: string;
  bold: boolean;
  zone: KotCustomLineZone;
  enabled: boolean;
  /** Absolute px; 0 = inherit from base. */
  fontSize: number;
};

export type KotReceiptFields = {
  branchName: boolean;
  headerSubtitle: boolean;
  documentTitle: boolean;
  orderRef: boolean;
  orderType: boolean;
  tableLabel: boolean;
  waiterName: boolean;
  notes: boolean;
  timestamp: boolean;
  itemHeaders: boolean;
  /** Qty column on item rows (kitchen always uses qty · item). */
  itemQty: boolean;
  /** Total items / total qty block. */
  itemTotals: boolean;
  footer: boolean;
  footerSecondary: boolean;
};

export const KOT_SYSTEM_BLOCKS = [
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

export type KotSystemBlockId = (typeof KOT_SYSTEM_BLOCKS)[number];

export type KotPrintSettings = {
  /** Bold + larger font for order number, order type, and table number. */
  emphasizeOrderMeta: boolean;
  /** Underline separator below each item row. */
  itemUnderlineSeparator: boolean;
  /** Base font size (px) for KOT body text (HTML path / editor hint). */
  baseFontSize: number;
  headerAlign: KotHeaderAlign;
  /** Overrides branch name on the ticket when set. */
  headerBusinessName: string;
  headerSubtitle: string;
  documentTitle: string;
  /** Title used when reprinting an edited / updated order. */
  documentTitleUpdate: string;
  footerText: string;
  footerSecondaryText: string;
  fields: KotReceiptFields;
  customLines: KotCustomLine[];
  blockOrder: string[];
};

export const DEFAULT_KOT_RECEIPT_FIELDS: KotReceiptFields = {
  branchName: true,
  headerSubtitle: false,
  documentTitle: true,
  orderRef: true,
  orderType: true,
  tableLabel: true,
  waiterName: true,
  notes: true,
  timestamp: true,
  itemHeaders: true,
  itemQty: true,
  itemTotals: true,
  footer: true,
  footerSecondary: false,
};

export const DEFAULT_KOT_BLOCK_ORDER: string[] = [...KOT_SYSTEM_BLOCKS];

export const KOT_SYSTEM_BLOCK_LABELS: Record<KotSystemBlockId, string> = {
  branchName: "Business / kitchen name",
  headerSubtitle: "Subtitle",
  documentTitle: "Ticket title",
  meta: "Order details",
  notes: "Notes",
  timestamp: "Date & time",
  items: "Items list",
  totals: "Item totals",
  footer: "Footer message",
  footerSecondary: "Footer secondary",
};

export const DEFAULT_KOT_PRINT_SETTINGS: KotPrintSettings = {
  emphasizeOrderMeta: true,
  itemUnderlineSeparator: false,
  baseFontSize: 15,
  headerAlign: "center",
  headerBusinessName: "",
  headerSubtitle: "",
  documentTitle: "Kitchen Order",
  documentTitleUpdate: "Kitchen Order — UPDATE REVISED",
  footerText: "KITCHEN COPY",
  footerSecondaryText: "",
  fields: DEFAULT_KOT_RECEIPT_FIELDS,
  customLines: [],
  blockOrder: [...DEFAULT_KOT_BLOCK_ORDER],
};

/** General Store slip defaults — same layout engine, retail wording. */
export const DEFAULT_STORE_SLIP_PRINT_SETTINGS: KotPrintSettings = {
  emphasizeOrderMeta: true,
  itemUnderlineSeparator: false,
  baseFontSize: 15,
  headerAlign: "center",
  headerBusinessName: "",
  headerSubtitle: "",
  documentTitle: "Sales Receipt",
  documentTitleUpdate: "Sales Receipt — UPDATE REVISED",
  footerText: "Thank you for shopping!",
  footerSecondaryText: "",
  fields: {
    ...DEFAULT_KOT_RECEIPT_FIELDS,
    tableLabel: false,
  },
  customLines: [],
  blockOrder: [...DEFAULT_KOT_BLOCK_ORDER],
};

export type SlipPrintPreset = "restaurant" | "general-store";

export function defaultSlipPrintSettings(preset: SlipPrintPreset = "restaurant"): KotPrintSettings {
  return preset === "general-store" ? DEFAULT_STORE_SLIP_PRINT_SETTINGS : DEFAULT_KOT_PRINT_SETTINGS;
}

export const STORE_SLIP_FIELD_LABELS: Record<keyof KotReceiptFields, string> = {
  branchName: "Store / business name",
  headerSubtitle: "Header subtitle (e.g. Main counter)",
  documentTitle: "Slip title",
  orderRef: "Invoice / ticket ref",
  orderType: "Sale type (Walk-in / Credit)",
  tableLabel: "Counter / till",
  waiterName: "Cashier / staff",
  notes: "Notes",
  timestamp: "Date & time",
  itemHeaders: "Column headers (Qty · Name)",
  itemQty: "Quantity column",
  itemTotals: "Total items / quantity",
  footer: "Footer message",
  footerSecondary: "Footer secondary line",
};

export const KOT_FIELD_GROUPS: { label: string; keys: (keyof KotReceiptFields)[] }[] = [
  {
    label: "Header",
    keys: ["branchName", "headerSubtitle", "documentTitle"],
  },
  {
    label: "Order details",
    keys: ["orderRef", "orderType", "tableLabel", "waiterName", "notes", "timestamp"],
  },
  {
    label: "Items",
    keys: ["itemHeaders", "itemQty", "itemTotals"],
  },
  {
    label: "Closing",
    keys: ["footer", "footerSecondary"],
  },
];

export const KOT_FIELD_LABELS: Record<keyof KotReceiptFields, string> = {
  branchName: "Business / kitchen name",
  headerSubtitle: "Header subtitle",
  documentTitle: "Ticket title",
  orderRef: "Order reference",
  orderType: "Order type",
  tableLabel: "Table / station",
  waiterName: "By (staff)",
  notes: "Notes",
  timestamp: "Date & time",
  itemHeaders: "Column headers (Qty · Name)",
  itemQty: "Quantity column",
  itemTotals: "Total items / quantity",
  footer: "Footer message",
  footerSecondary: "Footer secondary line",
};

export const KOT_PRINT_SETTINGS_CHANGED_EVENT = "pops-kot-print-settings-changed";

const STORAGE_KEY_V1 = "pops-kot-print-settings-v1";
const STORAGE_KEY_V2 = "pops-kot-print-settings-v2";
const STORAGE_KEY = "pops-kot-print-settings-v3";

function migrateKotToClassicSlip(
  settings: KotPrintSettings,
  preset: SlipPrintPreset = "restaurant",
): KotPrintSettings {
  const defaults = defaultSlipPrintSettings(preset);
  const footerText =
    !settings.footerText.trim() || settings.footerText.trim().toUpperCase() === "KITCHEN COPY"
      ? defaults.footerText
      : settings.footerText;
  // Strip the A/E legend that was briefly added at the bottom of kitchen slips.
  const rawSecondary = settings.footerSecondaryText.trim();
  const isAeLegend = /A:\s*New Item/i.test(rawSecondary) && /E:\s*Edited Item/i.test(rawSecondary);
  return {
    ...settings,
    footerText,
    footerSecondaryText: isAeLegend ? "" : settings.footerSecondaryText,
    fields: {
      ...settings.fields,
      footerSecondary: isAeLegend ? false : settings.fields.footerSecondary,
    },
  };
}

export const KOT_FONT_SIZE_MIN = 12;
export const KOT_FONT_SIZE_MAX = 35;

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_KOT_PRINT_SETTINGS.baseFontSize;
  return Math.max(KOT_FONT_SIZE_MIN, Math.min(KOT_FONT_SIZE_MAX, Math.round(value)));
}

function clampLineFont(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.max(10, Math.min(28, Math.round(value)));
}

export function isKotSystemBlock(id: string): id is KotSystemBlockId {
  return (KOT_SYSTEM_BLOCKS as readonly string[]).includes(id);
}

export function newKotCustomLine(
  partial?: Partial<Omit<KotCustomLine, "id">> & { id?: string },
): KotCustomLine {
  return {
    id: partial?.id ?? `kot-line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: partial?.text ?? "New line",
    bold: partial?.bold ?? false,
    zone: partial?.zone ?? "footer",
    enabled: partial?.enabled ?? true,
    fontSize: clampLineFont(partial?.fontSize ?? 0),
  };
}

function normalizeFields(input: Partial<KotReceiptFields> | undefined): KotReceiptFields {
  const base = DEFAULT_KOT_RECEIPT_FIELDS;
  return {
    branchName: input?.branchName ?? base.branchName,
    headerSubtitle: input?.headerSubtitle ?? base.headerSubtitle,
    documentTitle: input?.documentTitle ?? base.documentTitle,
    orderRef: input?.orderRef ?? base.orderRef,
    orderType: input?.orderType ?? base.orderType,
    tableLabel: input?.tableLabel ?? base.tableLabel,
    waiterName: input?.waiterName ?? base.waiterName,
    notes: input?.notes ?? base.notes,
    timestamp: input?.timestamp ?? base.timestamp,
    itemHeaders: input?.itemHeaders ?? base.itemHeaders,
    itemQty: input?.itemQty ?? base.itemQty,
    itemTotals: input?.itemTotals ?? base.itemTotals,
    footer: input?.footer ?? base.footer,
    footerSecondary: input?.footerSecondary ?? base.footerSecondary,
  };
}

function normalizeCustomLines(raw: unknown): KotCustomLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = (row ?? {}) as Partial<KotCustomLine>;
    return newKotCustomLine({
      id: typeof r.id === "string" ? r.id : undefined,
      text: typeof r.text === "string" ? r.text : "New line",
      bold: Boolean(r.bold),
      zone:
        r.zone === "header" || r.zone === "beforeItems" || r.zone === "afterItems" || r.zone === "footer"
          ? r.zone
          : "footer",
      enabled: r.enabled !== false,
      fontSize: clampLineFont(Number(r.fontSize) || 0),
    });
  });
}

function normalizeBlockOrder(raw: unknown, customIds: string[]): string[] {
  const allowed = new Set<string>([...KOT_SYSTEM_BLOCKS, ...customIds]);
  const fromInput = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && allowed.has(id))
    : [];
  const seen = new Set(fromInput);
  const missing = [...KOT_SYSTEM_BLOCKS, ...customIds].filter((id) => !seen.has(id));
  return [...fromInput, ...missing];
}

export function normalizeKotPrintSettings(input: Partial<KotPrintSettings> | null | undefined): KotPrintSettings {
  const base = DEFAULT_KOT_PRINT_SETTINGS;
  let baseFontSize = clampFontSize(input?.baseFontSize ?? base.baseFontSize);
  // Migrate old tiny defaults (≤12) to the new kitchen-readable size.
  if (baseFontSize <= 12 && input?.baseFontSize == null) baseFontSize = base.baseFontSize;

  // Legacy v1: showItemTotals → fields.itemTotals
  const legacy = input as Partial<KotPrintSettings> & { showItemTotals?: boolean };
  const fieldsPartial: Partial<KotReceiptFields> = { ...(input?.fields ?? {}) };
  if (fieldsPartial.itemTotals === undefined && typeof legacy.showItemTotals === "boolean") {
    fieldsPartial.itemTotals = legacy.showItemTotals;
  }

  const customLines = normalizeCustomLines(input?.customLines);
  const customIds = customLines.map((l) => l.id);

  return {
    emphasizeOrderMeta: input?.emphasizeOrderMeta ?? base.emphasizeOrderMeta,
    itemUnderlineSeparator: input?.itemUnderlineSeparator ?? base.itemUnderlineSeparator,
    baseFontSize,
    headerAlign: input?.headerAlign === "left" ? "left" : "center",
    headerBusinessName:
      typeof input?.headerBusinessName === "string" ? input.headerBusinessName : base.headerBusinessName,
    headerSubtitle: typeof input?.headerSubtitle === "string" ? input.headerSubtitle : base.headerSubtitle,
    documentTitle:
      typeof input?.documentTitle === "string" && input.documentTitle.trim()
        ? input.documentTitle
        : base.documentTitle,
    documentTitleUpdate:
      typeof input?.documentTitleUpdate === "string" && input.documentTitleUpdate.trim()
        ? input.documentTitleUpdate
        : base.documentTitleUpdate,
    footerText: typeof input?.footerText === "string" ? input.footerText : base.footerText,
    footerSecondaryText:
      typeof input?.footerSecondaryText === "string"
        ? input.footerSecondaryText
        : base.footerSecondaryText,
    fields: normalizeFields(fieldsPartial),
    customLines,
    blockOrder: normalizeBlockOrder(input?.blockOrder, customIds),
  };
}

function storageKey(branchCode: string, preset: SlipPrintPreset = "restaurant"): string {
  const suffix = preset === "general-store" ? "store-slip" : STORAGE_KEY;
  return `${suffix}.${branchCode.trim().toUpperCase()}`;
}

export function loadKotPrintSettings(
  branchCode: string | undefined,
  preset: SlipPrintPreset = "restaurant",
): KotPrintSettings {
  const defaults = defaultSlipPrintSettings(preset);
  if (!branchCode || typeof localStorage === "undefined") return defaults;
  try {
    const v3 = localStorage.getItem(storageKey(branchCode, preset));
    if (v3) {
      return migrateKotToClassicSlip(
        normalizeKotPrintSettings(JSON.parse(v3) as Partial<KotPrintSettings>),
        preset,
      );
    }
    if (preset === "restaurant") {
      const v2 = localStorage.getItem(`${STORAGE_KEY_V2}.${branchCode.trim().toUpperCase()}`);
      if (v2) {
        return migrateKotToClassicSlip(
          normalizeKotPrintSettings(JSON.parse(v2) as Partial<KotPrintSettings>),
          preset,
        );
      }
      const v1map = localStorage.getItem(STORAGE_KEY_V1);
      if (v1map) {
        const parsed = JSON.parse(v1map) as Record<string, Partial<KotPrintSettings>>;
        const legacy = parsed[branchCode] ?? parsed[branchCode.trim().toUpperCase()];
        if (legacy) {
          return migrateKotToClassicSlip(normalizeKotPrintSettings(legacy), preset);
        }
      }
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export function saveKotPrintSettings(
  branchCode: string,
  settings: KotPrintSettings,
  preset: SlipPrintPreset = "restaurant",
): void {
  const next = normalizeKotPrintSettings(settings);
  try {
    localStorage.setItem(storageKey(branchCode, preset), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(KOT_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode, preset } }),
    );
  } catch {
    // ignore
  }
}

/** Map General Store slip designer → receipt engine (money columns + same header/footer/blocks). */
export function storeSlipToBillPrintSettings(slip: KotPrintSettings): BillPrintSettings {
  return normalizeBillPrintSettings({
    baseFontSize: slip.baseFontSize,
    layout: "compact",
    headerAlign: slip.headerAlign,
    headerBusinessName: slip.headerBusinessName,
    headerSubtitle: slip.headerSubtitle,
    documentTitle: slip.documentTitle || "Sales Receipt",
    footerText: slip.footerText || "Thank you for shopping!",
    footerSecondaryText: slip.footerSecondaryText,
    fields: {
      ...DEFAULT_BILL_RECEIPT_FIELDS,
      branchName: slip.fields.branchName,
      headerSubtitle: slip.fields.headerSubtitle,
      documentTitle: slip.fields.documentTitle,
      orderRef: slip.fields.orderRef,
      orderType: slip.fields.orderType,
      tableLabel: slip.fields.tableLabel,
      billRef: slip.fields.orderRef,
      waiterName: slip.fields.waiterName,
      printerName: false,
      notes: slip.fields.notes,
      timestamp: slip.fields.timestamp,
      branchCode: false,
      itemHeaders: slip.fields.itemHeaders,
      itemQty: slip.fields.itemQty,
      itemAmount: true,
      subtotal: true,
      discount: true,
      service: false,
      tax: true,
      delivery: false,
      total: true,
      footer: slip.fields.footer,
      footerSecondary: slip.fields.footerSecondary,
    },
    customLines: slip.customLines.map((line) => ({
      id: line.id,
      text: line.text,
      bold: line.bold,
      zone: line.zone,
      enabled: line.enabled,
      fontSize: line.fontSize,
      color: "",
    })),
    blockOrder: slip.blockOrder.length > 0 ? slip.blockOrder : [...DEFAULT_BILL_BLOCK_ORDER],
    blockStyles: {},
  });
}

export function loadStoreBillPrintSettings(branchCode: string | undefined): BillPrintSettings {
  return storeSlipToBillPrintSettings(loadKotPrintSettings(branchCode, "general-store"));
}

/** Sample KOT for customization preview. */
export function sampleKotPrintSettingsPreviewName(branchName: string): string {
  return branchName || "Kitchen";
}
