import {
  DEFAULT_BILL_RECEIPT_FIELDS,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";

export type BillPrintTemplate = {
  id: string;
  name: string;
  settings: BillPrintSettings;
  updatedAt: string;
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

/** Built-in starter templates admins can clone into saved templates. */
export function starterBillPrintTemplates(): Omit<BillPrintTemplate, "id" | "updatedAt">[] {
  return [
    {
      name: "Classic Tax Invoice",
      settings: normalizeBillPrintSettings({
        documentTitle: "Tax Invoice",
        footerText: "Thank you — visit again",
        layout: "standard",
        headerAlign: "center",
      }),
    },
    {
      name: "Compact Thermal",
      settings: normalizeBillPrintSettings({
        documentTitle: "Receipt",
        layout: "compact",
        baseFontSize: 13,
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
      settings: normalizeBillPrintSettings({
        documentTitle: "Guest Check",
        footerText: "Please pay at the counter",
        customLines: [
          {
            id: "guest-sig",
            text: "Signature: ____________________",
            bold: false,
            zone: "footer",
            enabled: true,
            fontSize: 12,
          },
        ],
      }),
    },
    {
      name: "Takeaway Slip",
      settings: normalizeBillPrintSettings({
        documentTitle: "Takeaway",
        footerText: "Collect your order · Thank you",
        layout: "compact",
        customLines: [
          {
            id: "tw-ready",
            text: "Order ready for pickup",
            bold: true,
            zone: "beforeItems",
            enabled: true,
            fontSize: 13,
          },
        ],
      }),
    },
    {
      name: "Detailed Invoice",
      settings: normalizeBillPrintSettings({
        documentTitle: "Tax Invoice",
        footerText: "Thank you for your business",
        footerSecondaryText: "Prices include applicable taxes",
        layout: "standard",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: true,
          footerSecondary: true,
        },
      }),
    },
  ];
}
