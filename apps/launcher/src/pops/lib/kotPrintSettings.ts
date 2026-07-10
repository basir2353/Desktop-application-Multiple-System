export type KotPrintSettings = {
  /** Bold + larger font for order number, order type, and table number. */
  emphasizeOrderMeta: boolean;
  /** Show total line count and total quantity on KOT. */
  showItemTotals: boolean;
  /** Underline separator below each item row. */
  itemUnderlineSeparator: boolean;
  /** Base font size (px) for KOT body text. */
  baseFontSize: number;
};

export const DEFAULT_KOT_PRINT_SETTINGS: KotPrintSettings = {
  emphasizeOrderMeta: true,
  showItemTotals: true,
  itemUnderlineSeparator: true,
  baseFontSize: 11,
};

export const KOT_PRINT_SETTINGS_CHANGED_EVENT = "pops-kot-print-settings-changed";

const STORAGE_KEY = "pops-kot-print-settings-v1";

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_KOT_PRINT_SETTINGS.baseFontSize;
  return Math.max(9, Math.min(14, Math.round(value)));
}

export function normalizeKotPrintSettings(input: Partial<KotPrintSettings>): KotPrintSettings {
  return {
    emphasizeOrderMeta: input.emphasizeOrderMeta ?? DEFAULT_KOT_PRINT_SETTINGS.emphasizeOrderMeta,
    showItemTotals: input.showItemTotals ?? DEFAULT_KOT_PRINT_SETTINGS.showItemTotals,
    itemUnderlineSeparator:
      input.itemUnderlineSeparator ?? DEFAULT_KOT_PRINT_SETTINGS.itemUnderlineSeparator,
    baseFontSize: clampFontSize(input.baseFontSize ?? DEFAULT_KOT_PRINT_SETTINGS.baseFontSize),
  };
}

export function loadKotPrintSettings(branchCode: string | undefined): KotPrintSettings {
  if (!branchCode) return DEFAULT_KOT_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KOT_PRINT_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<KotPrintSettings>>;
    return normalizeKotPrintSettings(parsed[branchCode] ?? DEFAULT_KOT_PRINT_SETTINGS);
  } catch {
    return DEFAULT_KOT_PRINT_SETTINGS;
  }
}

export function saveKotPrintSettings(branchCode: string, settings: KotPrintSettings): void {
  const next = normalizeKotPrintSettings(settings);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, KotPrintSettings>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(KOT_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
    );
  } catch {
    // ignore storage errors
  }
}
