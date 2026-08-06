/**
 * Complete self-test for Paper & layout / Custom roll width / receipt HTML.
 * Used by unit tests and the Printer → Customize → Complete test button.
 */

import { sampleBillPrintInput } from "./billSampleReceipt";
import { buildPrintPreviewHtml } from "./printTicket";
import type { PrinterPaperSize } from "./printerRouting";
import {
  DEFAULT_THERMAL_PRINT_SETTINGS,
  isNarrowPaperWidth,
  loadThermalPrintSettings,
  normalizeThermalPrintSettings,
  paperSizeLabel,
  paperWidthMm,
  receiptRenderWidthPx,
  resolveThermalPaperSize,
  thermalContentWidthMm,
  type ThermalPrintSettings,
} from "./thermalPrintSettings";

export type ThermalSelfTestCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type ThermalSelfTestResult = {
  ok: boolean;
  passed: number;
  failed: number;
  checks: ThermalSelfTestCheck[];
  summary: string;
  thermal: ThermalPrintSettings;
  rollMm: number;
};

function check(id: string, label: string, ok: boolean, detail: string): ThermalSelfTestCheck {
  return { id, label, ok, detail };
}

export { resolveThermalPaperSize };

export function runThermalPrintSelfTest(input: {
  branchCode: string;
  branchName?: string;
  /** Override draft (unsaved preview) — otherwise loads saved branch settings. */
  thermal?: ThermalPrintSettings;
  /** Simulate a printer profile paperSize (e.g. stale 80mm). */
  profilePaperSize?: PrinterPaperSize;
}): ThermalSelfTestResult {
  const branchCode = input.branchCode.trim() || "TEST";
  const thermal = normalizeThermalPrintSettings(
    input.thermal ?? loadThermalPrintSettings(branchCode),
  );
  const paper = resolveThermalPaperSize(input.profilePaperSize, thermal);
  const rollMm = paperWidthMm(paper, thermal.customPaperWidthMm);
  const contentMm = thermalContentWidthMm(paper, thermal.marginMm, thermal.customPaperWidthMm);
  const renderPx = receiptRenderWidthPx(paper, thermal.customPaperWidthMm);
  const narrow = isNarrowPaperWidth(paper, thermal.customPaperWidthMm);

  const html = buildPrintPreviewHtml({
    ...sampleBillPrintInput(input.branchName ?? branchCode, branchCode),
    kind: "receipt",
    paperSize: paper,
    thermal,
  });

  const checks: ThermalSelfTestCheck[] = [];

  checks.push(
    check(
      "paper-resolved",
      "Paper size resolves",
      paper === thermal.defaultPaperSize ||
        (thermal.defaultPaperSize === "custom" && paper === "custom") ||
        (input.profilePaperSize === "custom" && paper === "custom"),
      `thermal=${thermal.defaultPaperSize}, profile=${input.profilePaperSize ?? "—"}, resolved=${paper}`,
    ),
  );

  checks.push(
    check(
      "custom-mm",
      "Custom roll width applies",
      thermal.defaultPaperSize !== "custom" ||
        (paper === "custom" && rollMm === thermal.customPaperWidthMm),
      thermal.defaultPaperSize === "custom"
        ? `customPaperWidthMm=${thermal.customPaperWidthMm} → rollMm=${rollMm}`
        : `not custom (${paperSizeLabel(paper, thermal.customPaperWidthMm)})`,
    ),
  );

  checks.push(
    check(
      "custom-beats-profile",
      "Custom beats stale profile 80mm",
      thermal.defaultPaperSize !== "custom" ||
        resolveThermalPaperSize("80mm", thermal) === "custom",
      thermal.defaultPaperSize === "custom"
        ? "profile 80mm correctly overridden by thermal custom"
        : "skipped (paper is not custom)",
    ),
  );

  checks.push(
    check(
      "content-width",
      "Content width within roll",
      contentMm > 0 && contentMm <= rollMm && contentMm >= 40,
      `contentWidthMm=${contentMm}, rollMm=${rollMm}, margin=${thermal.marginMm}`,
    ),
  );

  checks.push(
    check(
      "render-px",
      "Raster width scales with mm",
      renderPx >= 100 &&
        (paper === "A4" ||
          Math.abs(renderPx - Math.round((rollMm / 25.4) * 203 * 0.98)) <= 2),
      `receiptRenderWidthPx=${renderPx}`,
    ),
  );

  const pageNeedle = paper === "A4" ? "A4 portrait" : `${rollMm}mm 297mm`;
  checks.push(
    check(
      "html-page-size",
      "HTML @page uses roll mm",
      html.includes(pageNeedle),
      html.includes(pageNeedle) ? `found “${pageNeedle}”` : `missing “${pageNeedle}” in ticket HTML`,
    ),
  );

  const expectStack = narrow;
  const hasStack = html.includes("pay-compare pay-compare-stack");
  checks.push(
    check(
      "pay-compare-layout",
      "Card/Cash layout for paper width",
      expectStack ? hasStack : !hasStack && html.includes('class="pay-compare"'),
      expectStack
        ? hasStack
          ? "stacked (narrow OK)"
          : "expected stacked Card/Cash on narrow paper"
        : hasStack
          ? "unexpected stack — should be side-by-side on 80mm+"
          : "side-by-side Card/Cash (OK)",
    ),
  );

  const expectPrice =
    thermal.receiptLayout === "columns" && thermal.showUnitPrice && !narrow;
  const hasPriceCol =
    html.includes('<span class="item-price">') || html.includes(">PRICE</span>");
  checks.push(
    check(
      "price-column",
      "Unit price column matches settings",
      expectPrice ? hasPriceCol : !hasPriceCol,
      expectPrice
        ? hasPriceCol
          ? "PRICE column present"
          : "expected PRICE column but missing"
        : hasPriceCol
          ? "PRICE column should be hidden"
          : "PRICE column correctly omitted",
    ),
  );

  checks.push(
    check(
      "items-present",
      "Sample items render",
      html.includes("Soft drink") && (html.includes("item-row") || html.includes("clear-item")),
      html.includes("Soft drink") ? "sample lines present" : "sample items missing from HTML",
    ),
  );

  checks.push(
    check(
      "card-cash-totals",
      "Card/Cash GST compare present",
      /CARD PAYMENT|On Card Payment/i.test(html) && /CASH PAYMENT|On Cash Payment/i.test(html),
      "Card and Cash payment blocks found",
    ),
  );

  for (const [preset, mm] of [
    ["58mm", 58],
    ["80mm", 80],
    ["100mm", 100],
  ] as const) {
    checks.push(
      check(
        `preset-${preset}`,
        `Preset ${preset} = ${mm}mm`,
        paperWidthMm(preset) === mm,
        `${paperWidthMm(preset)}mm`,
      ),
    );
  }

  checks.push(
    check(
      "clamp-custom",
      "Custom mm clamp 48–120",
      paperWidthMm("custom", 40) === 48 &&
        paperWidthMm("custom", 200) === 120 &&
        paperWidthMm("custom", 72) === 72,
      "40→48, 200→120, 72→72",
    ),
  );

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  const ok = failed === 0;
  const summary = ok
    ? `All ${passed} checks passed · ${paperSizeLabel(paper, thermal.customPaperWidthMm)} · ${rollMm}mm`
    : `${failed} failed / ${checks.length} · ${paperSizeLabel(paper, thermal.customPaperWidthMm)}`;

  return { ok, passed, failed, checks, summary, thermal, rollMm };
}

/** Build a labeled complete test slip (notes show paper settings for physical verify). */
export function completeTestBillNotes(thermal: ThermalPrintSettings, rollMm: number): string {
  const layout =
    thermal.receiptLayout === "clear" ? "Stacked" : thermal.showUnitPrice ? "Columns+Price" : "Columns";
  return `TEST · ${paperSizeLabel(thermal.defaultPaperSize, thermal.customPaperWidthMm)} · ${rollMm}mm · margin ${thermal.marginMm} · ${layout}`;
}

export function defaultThermalForCompleteTest(): ThermalPrintSettings {
  return normalizeThermalPrintSettings({
    ...DEFAULT_THERMAL_PRINT_SETTINGS,
    defaultPaperSize: "custom",
    customPaperWidthMm: 80,
    receiptLayout: "columns",
    showUnitPrice: true,
    compactMoney: true,
    marginMm: 1,
  });
}
