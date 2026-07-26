import type { PrinterPaperSize } from "./printerRouting";

/** How item lines are laid out on physical thermal printers. */
export type ThermalReceiptLayout = "clear" | "columns";

/** Branch-level defaults for physical thermal / receipt printers. */
export type ThermalPrintSettings = {
  /** Used when a profile does not set paperSize. */
  defaultPaperSize: PrinterPaperSize;
  /** Printable margin in mm (keep low for thermal). */
  marginMm: number;
  /**
   * clear = stacked lines (item then amount) — best for 58mm, never clips.
   * columns = Qty | Item | Price | Amt — only for wide 80mm rolls.
   */
  receiptLayout: ThermalReceiptLayout;
  /** Show unit Price column (columns layout / wide paper only). */
  showUnitPrice: boolean;
  /** Compact money: 1430 instead of 1,430 (no thousand separators). */
  compactMoney: boolean;
  /** When true, prefix amounts with "Rs". Default off for thermal receipts. */
  showCurrencyPrefix: boolean;
  /** Plain-text wrap width for 58mm named-printer jobs. */
  charsPerLine58: number;
  /** Plain-text wrap width for 80mm named-printer jobs. */
  charsPerLine80: number;
};

export const DEFAULT_THERMAL_PRINT_SETTINGS: ThermalPrintSettings = {
  defaultPaperSize: "80mm",
  /** Keep near zero so 80mm / 3" rolls fill edge-to-edge. */
  marginMm: 1,
  receiptLayout: "columns",
  showUnitPrice: true,
  compactMoney: true,
  showCurrencyPrefix: false,
  /**
   * ESC/POS Font A on 80mm = 48 chars (standard). GDI Consolas is sized to match.
   * 58mm Font A ≈ 32; we use 32 printable with a small safety margin.
   */
  charsPerLine58: 32,
  charsPerLine80: 48,
};

export const THERMAL_PRINT_SETTINGS_CHANGED_EVENT = "pops-thermal-print-settings-changed";

const STORAGE_KEY = "pops-thermal-print-settings-v2";

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function normalizeThermalPrintSettings(
  input: Partial<ThermalPrintSettings> | null | undefined,
): ThermalPrintSettings {
  const base = DEFAULT_THERMAL_PRINT_SETTINGS;
  const paper =
    input?.defaultPaperSize === "58mm" || input?.defaultPaperSize === "A4" || input?.defaultPaperSize === "80mm"
      ? input.defaultPaperSize
      : base.defaultPaperSize;
  const layout =
    input?.receiptLayout === "columns" || input?.receiptLayout === "clear"
      ? input.receiptLayout
      : base.receiptLayout;
  return {
    defaultPaperSize: paper,
    marginMm: clamp(Number(input?.marginMm), 0, 8, base.marginMm),
    receiptLayout: layout,
    showUnitPrice: input?.showUnitPrice ?? base.showUnitPrice,
    compactMoney: input?.compactMoney ?? base.compactMoney,
    showCurrencyPrefix: input?.showCurrencyPrefix ?? base.showCurrencyPrefix,
    charsPerLine58: clamp(Number(input?.charsPerLine58), 24, 48, base.charsPerLine58),
    charsPerLine80: clamp(Number(input?.charsPerLine80), 40, 64, base.charsPerLine80),
  };
}

function storageKey(branchCode: string): string {
  return `${STORAGE_KEY}.${branchCode.trim().toUpperCase()}`;
}

export function loadThermalPrintSettings(branchCode: string | undefined | null): ThermalPrintSettings {
  if (!branchCode || typeof localStorage === "undefined") return DEFAULT_THERMAL_PRINT_SETTINGS;
  try {
    const raw =
      localStorage.getItem(storageKey(branchCode)) ??
      // Migrate v1 → v2 (v1 forced Clear on 58mm; Pay receipt should use columns).
      localStorage.getItem(`pops-thermal-print-settings-v1.${branchCode.trim().toUpperCase()}`);
    if (!raw) return DEFAULT_THERMAL_PRINT_SETTINGS;
    const parsed = normalizeThermalPrintSettings(JSON.parse(raw) as Partial<ThermalPrintSettings>);
    // Prefer columns for customer Pay receipts unless user explicitly kept Clear in v2.
    if (!localStorage.getItem(storageKey(branchCode)) && parsed.receiptLayout === "clear") {
      return normalizeThermalPrintSettings({
        ...parsed,
        receiptLayout: "columns",
        showUnitPrice: true,
        showCurrencyPrefix: false,
      });
    }
    // Migrate old under-width 80mm (42) → standard 48 so rolls fill correctly.
    if (parsed.charsPerLine80 > 0 && parsed.charsPerLine80 < 48) {
      return normalizeThermalPrintSettings({
        ...parsed,
        charsPerLine80: 48,
        receiptLayout: parsed.defaultPaperSize === "80mm" ? "columns" : parsed.receiptLayout,
        showUnitPrice:
          parsed.defaultPaperSize === "80mm" ? true : parsed.showUnitPrice,
      });
    }
    if (parsed.charsPerLine58 > 0 && parsed.charsPerLine58 < 28) {
      return normalizeThermalPrintSettings({ ...parsed, charsPerLine58: 32 });
    }
    return parsed;
  } catch {
    return DEFAULT_THERMAL_PRINT_SETTINGS;
  }
}

export function saveThermalPrintSettings(
  branchCode: string,
  settings: Partial<ThermalPrintSettings>,
): ThermalPrintSettings {
  const next = normalizeThermalPrintSettings({
    ...loadThermalPrintSettings(branchCode),
    ...settings,
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(branchCode), JSON.stringify(next));
  }
  window.dispatchEvent(
    new CustomEvent(THERMAL_PRINT_SETTINGS_CHANGED_EVENT, { detail: { branchCode } }),
  );
  return next;
}

export function thermalContentWidthMm(paper: PrinterPaperSize, marginMm: number): number {
  const page = paper === "58mm" ? 58 : paper === "A4" ? 190 : 80;
  // Fill the roll — tiny edge only (was leaving a large empty band on 80mm / 3").
  const edge = paper === "A4" ? 2 : paper === "80mm" ? 0 : 1;
  const m = Math.max(0, Math.min(2, marginMm));
  return Math.max(40, page - m * 2 - edge);
}

export function thermalCharsPerLine(
  paper: PrinterPaperSize,
  settings: ThermalPrintSettings,
): number {
  if (paper === "58mm") return settings.charsPerLine58;
  if (paper === "A4") return 64;
  return settings.charsPerLine80;
}
