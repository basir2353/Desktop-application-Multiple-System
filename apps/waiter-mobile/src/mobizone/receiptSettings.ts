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
  documentTitle: string;
  footerText: string;
  paperWidthMm: 58 | 80;
  fields: MobizoneReceiptFields;
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
  documentTitle: "Sale Receipt",
  footerText: "Thank you for your business",
  paperWidthMm: 80,
  fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS },
};

function storageKey(branchCode: string): string {
  return `mobizone-receipt-settings-v1:${branchCode || "MAIN"}`;
}

function normalize(raw: Partial<MobizoneReceiptSettings> | null | undefined): MobizoneReceiptSettings {
  return {
    shopName: (raw?.shopName ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.shopName).trim() || "MobiZone",
    shopPhone: raw?.shopPhone ?? "",
    shopAddress: raw?.shopAddress ?? "",
    documentTitle:
      (raw?.documentTitle ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.documentTitle).trim() || "Sale Receipt",
    footerText: raw?.footerText ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.footerText,
    paperWidthMm: raw?.paperWidthMm === 58 ? 58 : 80,
    fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS, ...(raw?.fields ?? {}) },
  };
}

export function loadMobizoneReceiptSettings(branchCode: string): MobizoneReceiptSettings {
  try {
    const raw = mzStorageGet(storageKey(branchCode));
    if (!raw) return normalize(null);
    return normalize(JSON.parse(raw) as Partial<MobizoneReceiptSettings>);
  } catch {
    return normalize(null);
  }
}

export function saveMobizoneReceiptSettings(
  branchCode: string,
  settings: MobizoneReceiptSettings,
): void {
  mzStorageSet(storageKey(branchCode), JSON.stringify(normalize(settings)));
}
