/** Platform branding printed on every receipt (above Thank you). Only super admin may change it. */

export const RECEIPT_BRANDING_CHANGED_EVENT = "pops-receipt-branding-changed";

const STORAGE_KEY = "pops-receipt-branding-v1";

export const DEFAULT_RECEIPT_POWERED_BY = "powered by +92 307 5417212";

export type ReceiptBrandingSettings = {
  poweredBy: string;
};

export function normalizeReceiptBranding(
  input: Partial<ReceiptBrandingSettings> | null | undefined,
): ReceiptBrandingSettings {
  const poweredBy = (input?.poweredBy ?? DEFAULT_RECEIPT_POWERED_BY).trim();
  return {
    poweredBy: poweredBy || DEFAULT_RECEIPT_POWERED_BY,
  };
}

export function loadReceiptBranding(): ReceiptBrandingSettings {
  if (typeof localStorage === "undefined") {
    return normalizeReceiptBranding(null);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeReceiptBranding(null);
    return normalizeReceiptBranding(JSON.parse(raw) as Partial<ReceiptBrandingSettings>);
  } catch {
    return normalizeReceiptBranding(null);
  }
}

export function loadReceiptPoweredBy(): string {
  return loadReceiptBranding().poweredBy;
}

/** Super-admin only — regular bill customization must not call this. */
export function saveReceiptBranding(settings: Partial<ReceiptBrandingSettings>): ReceiptBrandingSettings {
  const next = normalizeReceiptBranding({
    ...loadReceiptBranding(),
    ...settings,
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  window.dispatchEvent(
    new CustomEvent(RECEIPT_BRANDING_CHANGED_EVENT, { detail: { settings: next } }),
  );
  return next;
}
