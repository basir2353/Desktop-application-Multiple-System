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
  /** Compact money: Rs1430 instead of Rs 1,430 */
  compactMoney: boolean;
  /** Plain-text wrap width for 58mm named-printer jobs. */
  charsPerLine58: number;
  /** Plain-text wrap width for 80mm named-printer jobs. */
  charsPerLine80: number;
};

export const DEFAULT_THERMAL_PRINT_SETTINGS: ThermalPrintSettings = {
  defaultPaperSize: "58mm",
  marginMm: 1,
  receiptLayout: "clear",
  showUnitPrice: false,
  compactMoney: true,
  charsPerLine58: 32,
  charsPerLine80: 42,
};

export const THERMAL_PRINT_SETTINGS_CHANGED_EVENT = "pops-thermal-print-settings-changed";

const STORAGE_KEY = "pops-thermal-print-settings-v1";

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
    charsPerLine58: clamp(Number(input?.charsPerLine58), 24, 40, base.charsPerLine58),
    charsPerLine80: clamp(Number(input?.charsPerLine80), 32, 56, base.charsPerLine80),
  };
}

function storageKey(branchCode: string): string {
  return `${STORAGE_KEY}.${branchCode.trim().toUpperCase()}`;
}

export function loadThermalPrintSettings(branchCode: string | undefined | null): ThermalPrintSettings {
  if (!branchCode || typeof localStorage === "undefined") return DEFAULT_THERMAL_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return DEFAULT_THERMAL_PRINT_SETTINGS;
    return normalizeThermalPrintSettings(JSON.parse(raw) as Partial<ThermalPrintSettings>);
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
  return Math.max(40, page - marginMm * 2);
}

export function thermalCharsPerLine(
  paper: PrinterPaperSize,
  settings: ThermalPrintSettings,
): number {
  if (paper === "58mm") return settings.charsPerLine58;
  if (paper === "A4") return 64;
  return settings.charsPerLine80;
}
