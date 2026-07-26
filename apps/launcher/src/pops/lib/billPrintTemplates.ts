import {
  DEFAULT_BILL_RECEIPT_FIELDS,
  newBillCustomLine,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";

export type BillPrintTemplate = {
  id: string;
  name: string;
  settings: BillPrintSettings;
  updatedAt: string;
};

export type BillPrintStarterTemplate = {
  name: string;
  /** Short hint shown under the starter button. */
  description: string;
  settings: BillPrintSettings;
};

export const BILL_PRINT_TEMPLATES_CHANGED_EVENT = "pops-bill-print-templates-changed";

const STORAGE_KEY = "pops-bill-print-templates-v1";
const MAX_TEMPLATES = 8;

type Store = Record<string, BillPrintTemplate[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store, branchCode: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(
    new CustomEvent(BILL_PRINT_TEMPLATES_CHANGED_EVENT, { detail: { branchCode } }),
  );
}

function newTemplateId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadBillPrintTemplates(branchCode: string | undefined): BillPrintTemplate[] {
  if (!branchCode) return [];
  const list = readStore()[branchCode] ?? [];
  return list
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || "Template").trim().slice(0, 40) || "Template",
      settings: normalizeBillPrintSettings(row.settings ?? {}),
      updatedAt: String(row.updatedAt || new Date().toISOString()),
    }))
    .slice(0, MAX_TEMPLATES);
}

export function saveBillPrintTemplate(
  branchCode: string,
  name: string,
  settings: BillPrintSettings,
  existingId?: string,
): BillPrintTemplate {
  const store = readStore();
  const current = store[branchCode] ?? [];
  const trimmed = name.trim().slice(0, 40) || "Template";
  const normalized = normalizeBillPrintSettings(settings);
  const now = new Date().toISOString();

  if (existingId) {
    const next = current.map((row) =>
      row.id === existingId
        ? { ...row, name: trimmed, settings: normalized, updatedAt: now }
        : row,
    );
    store[branchCode] = next.slice(0, MAX_TEMPLATES);
    writeStore(store, branchCode);
    const found = next.find((row) => row.id === existingId);
    if (found) return found;
  }

  if (current.length >= MAX_TEMPLATES) {
    throw new Error(`You can save up to ${MAX_TEMPLATES} bill templates. Delete one first.`);
  }

  const created: BillPrintTemplate = {
    id: newTemplateId(),
    name: trimmed,
    settings: normalized,
    updatedAt: now,
  };
  store[branchCode] = [...current, created];
  writeStore(store, branchCode);
  return created;
}

export function deleteBillPrintTemplate(branchCode: string, templateId: string): void {
  const store = readStore();
  store[branchCode] = (store[branchCode] ?? []).filter((row) => row.id !== templateId);
  writeStore(store, branchCode);
}

export function getBillPrintTemplate(
  branchCode: string | undefined,
  templateId: string,
): BillPrintTemplate | null {
  return loadBillPrintTemplates(branchCode).find((row) => row.id === templateId) ?? null;
}

/**
 * Built-in layouts inspired by common cafe / bakery / restaurant thermal bills.
 * Users clone → edit text → Assign to POS. Inspiration only — not locked designs.
 */
export function starterBillPrintTemplates(): BillPrintStarterTemplate[] {
  return [
    {
      name: "Cafe Receipt",
      description: "Centered brand · RECEIPT · thank-you footer (cafe / kitchen & bar style)",
      settings: normalizeBillPrintSettings({
        documentTitle: "RECEIPT",
        headerSubtitle: "Your address · Tel · www.yoursite.com",
        footerText: "Thank you!",
        footerSecondaryText: "WE APPRECIATE YOUR VISIT",
        layout: "compact",
        headerAlign: "center",
        baseFontSize: 13,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: true,
          footerSecondary: true,
          discount: true,
          delivery: false,
        },
        customLines: [
          newBillCustomLine({
            id: "cafe-open",
            text: "Dine-in · Takeaway · Delivery",
            bold: false,
            zone: "header",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Bakery Slip",
      description: "Simple Item×Qty · Price · Items/Qty · no-return note",
      settings: normalizeBillPrintSettings({
        documentTitle: "BILL",
        headerSubtitle: "Address · Tel",
        footerText: "NO RETURN. NO EXCHANGE.",
        footerSecondaryText: "",
        layout: "compact",
        headerAlign: "center",
        baseFontSize: 12,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          orderType: false,
          tableLabel: false,
          waiterName: false,
          printerName: false,
          service: false,
          tax: false,
          delivery: false,
          discount: false,
          headerSubtitle: true,
          footerSecondary: false,
          billRef: true,
        },
        customLines: [
          newBillCustomLine({
            id: "bakery-pay",
            text: "Payment: Cash / Card",
            bold: false,
            zone: "afterItems",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Restaurant Tax Bill",
      description: "GST-style header · Order/Bill/Table · ITEM QTY AMT (dining)",
      settings: normalizeBillPrintSettings({
        documentTitle: "TAX INVOICE",
        headerSubtitle: "Address · Phone · NTN / GSTIN",
        footerText: "Thank you — visit again",
        footerSecondaryText: "Prices include applicable taxes",
        layout: "standard",
        headerAlign: "center",
        baseFontSize: 13,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: true,
          footerSecondary: true,
          billRef: true,
          waiterName: true,
          tableLabel: true,
          service: true,
          tax: true,
        },
        customLines: [
          newBillCustomLine({
            id: "rest-pax",
            text: "Pax: __",
            bold: false,
            zone: "beforeItems",
            enabled: false,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Classic Tax Invoice",
      description: "Standard Pakistani POS invoice",
      settings: normalizeBillPrintSettings({
        documentTitle: "Tax Invoice",
        footerText: "Thank you — visit again",
        layout: "standard",
        headerAlign: "center",
      }),
    },
    {
      name: "Compact Thermal",
      description: "Tight 58mm roll — fewer fields",
      settings: normalizeBillPrintSettings({
        documentTitle: "Receipt",
        layout: "compact",
        baseFontSize: 11,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: false,
          footerSecondary: false,
          waiterName: false,
        },
      }),
    },
    {
      name: "Guest Check",
      description: "Pay-later slip",
      settings: normalizeBillPrintSettings({
        documentTitle: "Guest Check",
        footerText: "Please pay at the counter",
        customLines: [],
      }),
    },
    {
      name: "Takeaway Slip",
      description: "Pickup-ready takeaway ticket",
      settings: normalizeBillPrintSettings({
        documentTitle: "Takeaway",
        footerText: "Collect your order · Thank you",
        layout: "compact",
        customLines: [
          newBillCustomLine({
            id: "tw-ready",
            text: "Order ready for pickup",
            bold: true,
            zone: "beforeItems",
            enabled: true,
            fontSize: 13,
          }),
        ],
      }),
    },
  ];
}
