import { mzStorageGet, mzStorageSet } from "./storage";

export type MobizoneReceiptFields = {
  shopName: boolean;
  shopPhone: boolean;
  shopAddress: boolean;
  documentTitle: boolean;
  timestamp: boolean;
  customerName: boolean;
  customerPhone: boolean;
  customerCnic: boolean;
  customerAddress: boolean;
  device: boolean;
  imei: boolean;
  warranty: boolean;
  salePrice: boolean;
  cash: boolean;
  bank: boolean;
  bankDetails: boolean;
  remaining: boolean;
  dueDate: boolean;
  footer: boolean;
};

export type MobizoneReceiptSettings = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  whatsappNumber: string;
  whatsappDefaultOn: boolean;
  documentTitle: string;
  footerText: string;
  paperWidthMm: 58 | 80;
  fields: MobizoneReceiptFields;
  /** Set when last loaded/published from desktop (live API). */
  controlledByDesktop?: boolean;
  updatedAt?: string | null;
};

export const DEFAULT_MOBIZONE_RECEIPT_FIELDS: MobizoneReceiptFields = {
  shopName: true,
  shopPhone: true,
  shopAddress: true,
  documentTitle: true,
  timestamp: true,
  customerName: true,
  customerPhone: true,
  customerCnic: true,
  customerAddress: true,
  device: true,
  imei: true,
  warranty: true,
  salePrice: true,
  cash: true,
  bank: true,
  bankDetails: true,
  remaining: true,
  dueDate: true,
  footer: true,
};

export const DEFAULT_MOBIZONE_RECEIPT_SETTINGS: MobizoneReceiptSettings = {
  shopName: "MobiZone",
  shopPhone: "",
  shopAddress: "",
  whatsappNumber: "",
  whatsappDefaultOn: true,
  documentTitle: "Sale Receipt",
  footerText: "Thank you for your business",
  paperWidthMm: 80,
  fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS },
  controlledByDesktop: true,
  updatedAt: null,
};

function storageKey(branchCode: string): string {
  return `mobizone-receipt-settings-v1:${branchCode || "MAIN"}`;
}

export function normalizeMobizoneReceiptSettings(
  raw: Partial<MobizoneReceiptSettings> | null | undefined,
): MobizoneReceiptSettings {
  const shopPhone = (raw?.shopPhone ?? "").trim();
  const whatsappNumber = (raw?.whatsappNumber ?? shopPhone).trim();
  return {
    shopName: (raw?.shopName ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.shopName).trim() || "MobiZone",
    shopPhone,
    shopAddress: raw?.shopAddress ?? "",
    whatsappNumber,
    whatsappDefaultOn: raw?.whatsappDefaultOn !== false,
    documentTitle:
      (raw?.documentTitle ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.documentTitle).trim() || "Sale Receipt",
    footerText: raw?.footerText ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.footerText,
    paperWidthMm: raw?.paperWidthMm === 58 ? 58 : 80,
    fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS, ...(raw?.fields ?? {}) },
    controlledByDesktop: raw?.controlledByDesktop !== false,
    updatedAt: raw?.updatedAt ?? null,
  };
}

export function loadMobizoneReceiptSettings(branchCode: string): MobizoneReceiptSettings {
  try {
    const raw = mzStorageGet(storageKey(branchCode));
    if (!raw) return normalizeMobizoneReceiptSettings(null);
    return normalizeMobizoneReceiptSettings(JSON.parse(raw) as Partial<MobizoneReceiptSettings>);
  } catch {
    return normalizeMobizoneReceiptSettings(null);
  }
}

export function saveMobizoneReceiptSettings(
  branchCode: string,
  settings: MobizoneReceiptSettings,
): void {
  mzStorageSet(storageKey(branchCode), JSON.stringify(normalizeMobizoneReceiptSettings(settings)));
}

/** Digits for wa.me — prefers customer phone, falls back to shop WhatsApp. */
export function resolveWhatsAppTarget(
  partyPhone: string | null | undefined,
  settings: MobizoneReceiptSettings,
): string {
  const party = (partyPhone ?? "").replace(/\D/g, "");
  if (party.length >= 10) return party;
  return (settings.whatsappNumber || settings.shopPhone || "").replace(/\D/g, "");
}
