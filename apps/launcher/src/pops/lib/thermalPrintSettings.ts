import type { PrinterPaperSize } from "./printerRouting";

/** How item lines are laid out on physical thermal printers. */
export type ThermalReceiptLayout = "clear" | "columns";

/** Branch-level defaults for physical thermal / receipt printers. */
export type ThermalPrintSettings = {
  /** Used when a profile does not set paperSize. */
  defaultPaperSize: PrinterPaperSize;
  /** Roll width in mm when `defaultPaperSize` is `custom` (48–120). */
  customPaperWidthMm: number;
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
  customPaperWidthMm: 80,
  /** Keep near zero so 80mm / 3" rolls fill edge-to-edge. */
  marginMm: 1,
  receiptLayout: "columns",
  /** Off by default — Price+Amt together clips on real 80mm printable width. */
  showUnitPrice: false,
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
const MIN_CUSTOM_PAPER_MM = 48;
const MAX_CUSTOM_PAPER_MM = 120;

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function clampCustomPaperWidthMm(value: number, fallback = 80): number {
  return clamp(value, MIN_CUSTOM_PAPER_MM, MAX_CUSTOM_PAPER_MM, fallback);
}

const VALID_PAPER: PrinterPaperSize[] = ["58mm", "80mm", "100mm", "A4", "custom"];

export function paperWidthMm(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): number {
  switch (paper) {
    case "58mm":
      return 58;
    case "80mm":
      return 80;
    case "100mm":
      return 100;
    case "A4":
      return 210;
    case "custom":
      return clampCustomPaperWidthMm(customPaperWidthMm);
    default:
      return 80;
  }
}

/** Narrow rolls (≈58mm) — stacked layout, smaller fonts. */
export function isNarrowPaperWidth(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): boolean {
  return paperWidthMm(paper, customPaperWidthMm) <= 62;
}

/** Wide thermal rolls (≈80mm+) — column layout. */
export function isWidePaperWidth(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): boolean {
  const mm = paperWidthMm(paper, customPaperWidthMm);
  return mm >= 72 && paper !== "A4";
}

export function paperSizeLabel(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): string {
  if (paper === "A4") return "A4 sheet";
  if (paper === "custom") return `${paperWidthMm(paper, customPaperWidthMm)}mm roll`;
  return `${paper} roll`;
}

/**
 * Prefer branch thermal Custom mm over a stale profile preset.
 * Profile paperSize is used only when thermal is not set to custom.
 */
export function resolveThermalPaperSize(
  profilePaper: PrinterPaperSize | undefined,
  thermal: Pick<ThermalPrintSettings, "defaultPaperSize">,
): PrinterPaperSize {
  if (thermal.defaultPaperSize === "custom") return "custom";
  if (profilePaper === "custom") return "custom";
  return profilePaper ?? thermal.defaultPaperSize;
}

export function normalizeThermalPrintSettings(
  input: Partial<ThermalPrintSettings> | null | undefined,
): ThermalPrintSettings {
  const base = DEFAULT_THERMAL_PRINT_SETTINGS;
  const paper = VALID_PAPER.includes(input?.defaultPaperSize as PrinterPaperSize)
    ? (input!.defaultPaperSize as PrinterPaperSize)
    : base.defaultPaperSize;
  const layout =
    input?.receiptLayout === "columns" || input?.receiptLayout === "clear"
      ? input.receiptLayout
      : base.receiptLayout;
  return {
    defaultPaperSize: paper,
    customPaperWidthMm: clampCustomPaperWidthMm(
      Number(input?.customPaperWidthMm),
      base.customPaperWidthMm,
    ),
    marginMm: clamp(Number(input?.marginMm), 0, 8, base.marginMm),
    receiptLayout: layout,
    showUnitPrice: input?.showUnitPrice ?? base.showUnitPrice,
    compactMoney: input?.compactMoney ?? base.compactMoney,
    showCurrencyPrefix: input?.showCurrencyPrefix ?? base.showCurrencyPrefix,
    charsPerLine58: clamp(Number(input?.charsPerLine58), 24, 48, base.charsPerLine58),
    charsPerLine80: clamp(Number(input?.charsPerLine80), 40, 72, base.charsPerLine80),
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
    // Do not rewrite showUnitPrice — that was overwriting user customization on every load.
    if (parsed.charsPerLine80 > 0 && parsed.charsPerLine80 < 48) {
      const migrated = normalizeThermalPrintSettings({
        ...parsed,
        charsPerLine80: 48,
      });
      try {
        localStorage.setItem(storageKey(branchCode), JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
      return migrated;
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

export function thermalContentWidthMm(
  paper: PrinterPaperSize,
  marginMm: number,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): number {
  const page = paper === "A4" ? 190 : paperWidthMm(paper, customPaperWidthMm);
  const edge = paper === "A4" ? 2 : isWidePaperWidth(paper, customPaperWidthMm) ? 0 : 1;
  // Match UI clamp (0–8mm). Previously capped at 2 so "Side margin 3" did nothing.
  const m = Math.max(0, Math.min(8, marginMm));
  return Math.max(40, page - m * 2 - edge);
}

export function thermalCharsPerLine(
  paper: PrinterPaperSize,
  settings: ThermalPrintSettings,
): number {
  if (paper === "A4") return 64;
  const mm = paperWidthMm(paper, settings.customPaperWidthMm);
  if (mm <= 62) return settings.charsPerLine58;
  if (mm >= 80) {
    return Math.min(72, Math.round(settings.charsPerLine80 * (mm / 80)));
  }
  const ratio = (mm - 58) / (80 - 58);
  return Math.round(settings.charsPerLine58 + (settings.charsPerLine80 - settings.charsPerLine58) * ratio);
}

/** On-screen preview width (px) — scales with roll mm. */
export function previewPaperWidthPx(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): number {
  if (paper === "A4") return 420;
  return Math.round(paperWidthMm(paper, customPaperWidthMm) * 4.25);
}

/** Render width in px at ~203 DPI for raster / preview. */
export function receiptRenderWidthPx(
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): number {
  if (paper === "A4") return Math.round((190 / 25.4) * 203);
  const mm = paperWidthMm(paper, customPaperWidthMm);
  return Math.round((mm / 25.4) * 203 * 0.98);
}
