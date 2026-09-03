import type { Bill, BillPayment, KitchenTicket, PaymentMethod } from "@platform/contracts";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import {
  discountAmountFromTicketNotes,
  parseCashReceivedFromNotes,
  parseDeliveryFieldsFromNotes,
  receiptNotesWithoutPackedDeliveryContact,
  resolveTicketDeliveryNotes,
} from "./posLoadOrder";
import { computeTicketTotals, discountPctFromAmount } from "./posDiscount";
import { loadPosSettings, effectiveServicePctForMode, effectiveTaxPctForMode } from "./posSettings";
import { inferPosModeFromLabel } from "./posOrderMode";
import { parseItemsSummary, type PosRecentOrder } from "./recentOrders";
import {
  billReceiptFontSizes,
  getBlockStyle,
  isBillSystemBlock,
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  resolveBlockColor,
  resolveBlockFontSize,
  type BillPrintSettings,
} from "./billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "./billReceiptTemplateAssignments";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  isKotSystemBlock,
  loadKotPrintSettings,
  type KotCustomLine,
  type KotPrintSettings,
} from "./kotPrintSettings";
import { toPng } from "html-to-image";
import type { PrinterPaperSize, PrinterProfile } from "./printerRouting";
import { printerTextScaleFactor } from "./printerRouting";
import { loadReceiptPoweredBy } from "./receiptBranding";
import { resolveBusinessLogoSrc } from "./businessLogo";
import { printImageToSystemPrinter, printToSystemPrinter, isVirtualSystemPrinter, isXpsSystemPrinter, preferPdfOverXpsPrinter, isDesktopAppRuntime } from "./systemPrinters";
import { buildPraReceiptFooterHtml, PRA_RECEIPT_FOOTER_CSS, type PraReceiptFooter } from "./praReceiptFooter";
import { asPrinterName } from "./asPrinterName";
import {
  DEFAULT_THERMAL_PRINT_SETTINGS,
  isNarrowPaperWidth,
  loadThermalPrintSettings,
  normalizeThermalPrintSettings,
  paperWidthMm,
  receiptRenderWidthPx,
  resolveThermalPaperSize,
  thermalCharsPerLine,
  thermalContentWidthMm,
  type ThermalPrintSettings,
} from "./thermalPrintSettings";
import { sampleBillPrintInput } from "./billSampleReceipt";
import { useSessionStore } from "../../stores/sessionStore";

export type PrintLine = {
  label: string;
  qty: number;
  unitPrice: number;
};

export type PrintTicketInput = {
  kind: "receipt" | "kot";
  branchName: string;
  branchCode: string;
  orderRef: string;
  billRef?: string;
  modeLabel: string;
  tableLabel?: string;
  waiterName?: string;
  /** Display label for the ticket / job title (section or profile name). */
  printerName?: string;
  /** OS printer name — when set, print goes directly to this device (no dialog). */
  systemPrinterName?: string;
  copies?: number;
  paperSize?: PrinterPaperSize;
  /** Multiplier for slip text (from printer profile S/M/L). Default 1. */
  textScale?: number;
  /** Override branch thermal defaults (preview / unsaved draft). */
  thermal?: ThermalPrintSettings;
  notes?: string;
  /** Delivery / customer contact — printed as labeled meta rows on receipts. */
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  riderName?: string;
  lines: PrintLine[];
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  deliveryCharge?: number;
  total: number;
  servicePct: number;
  taxPct?: number;
  discountPct: number;
  /** Settled payment lines (cash / card / …) for simple invoice footer. */
  payments?: BillPayment[];
  /** Cash tendered by customer (when > total, receipt shows Change Due). */
  cashReceived?: number;
  kotSettings?: KotPrintSettings;
  billPrintSettings?: BillPrintSettings;
  /**
   * When true (edited kitchen ticket), KOT shows a clear UPDATE marker
   * so kitchen staff can tell it apart from a new order.
   */
  isOrderUpdate?: boolean;
  /** FPRA/Real PRA footer (invoice # + QR) printed under the order receipt. */
  praFiscal?: PraReceiptFooter | null;
  /** Override activity log kind (e.g. test page while using a live branchCode). */
  historyKind?: import("./printHistory").PrintKind;
  /**
   * Optional company logo for the receipt header (data URL preferred).
   * When omitted, Content Updation business logo is loaded from branchCode.
   */
  businessLogoSrc?: string | null;
};

function resolveDeliveryPrintContact(input: PrintTicketInput): {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  riderName: string;
} {
  const parsed = parseDeliveryFieldsFromNotes(input.notes);
  return {
    customerName: input.customerName?.trim() || parsed.customer,
    customerPhone: input.customerPhone?.trim() || parsed.phone,
    customerAddress: input.customerAddress?.trim() || parsed.address,
    riderName: input.riderName?.trim() || parsed.riderName,
  };
}

function hasStructuredDeliveryContact(contact: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  riderName: string;
}): boolean {
  return Boolean(
    contact.customerName ||
      contact.customerPhone ||
      contact.customerAddress ||
      contact.riderName,
  );
}

/** Apply a resolved printer profile onto a ticket payload. */
export function withPrinterProfile<T extends Omit<PrintTicketInput, "kind">>(
  input: T,
  profile: PrinterProfile | null | undefined,
): T {
  if (!profile) return input;
  const linked = asPrinterName(profile.systemPrinterName);
  const fromInput = asPrinterName(input.systemPrinterName);
  return {
    ...input,
    printerName: profile.name,
    systemPrinterName: linked ?? fromInput,
    copies: profile.copies,
    paperSize: profile.paperSize,
    textScale: printerTextScaleFactor(profile.textScale),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCustomLineHtml(
  settings: BillPrintSettings,
  lineId: string,
  align: "center" | "left",
  fallbackPx: number,
): string {
  const line = settings.customLines.find((row) => row.id === lineId);
  if (!line || !line.enabled || !line.text.trim()) return "";
  const size = resolveBlockFontSize(settings, lineId, fallbackPx);
  const weight = line.bold ? 600 : 400;
  const color = resolveBlockColor(settings, lineId);
  const colorCss = color ? `color:${color};` : "";
  const cls = line.bold ? "custom-line custom-line-bold" : "custom-line";
  return `<div class="${cls}" style="text-align:${align};font-size:${size}px;font-weight:${weight};${colorCss}">${escapeHtml(line.text.trim())}</div>`;
}

function blockStyleInline(
  settings: BillPrintSettings,
  blockId: string,
  fallbackPx: number,
): string {
  const size = resolveBlockFontSize(settings, blockId, fallbackPx);
  const bold = isBillSystemBlock(blockId)
    ? getBlockStyle(settings, blockId).bold
    : Boolean(settings.customLines.find((l) => l.id === blockId)?.bold);
  const color = resolveBlockColor(settings, blockId);
  const colorCss = color ? `color:${color};` : "";
  return `font-size:${size}px;font-weight:${bold ? 600 : 400};${colorCss}`;
}

function blockInkClass(settings: BillPrintSettings, blockId: string): string {
  return resolveBlockColor(settings, blockId) ? " ink-custom" : "";
}

function pushCustomLinePlain(
  out: string[],
  settings: BillPrintSettings,
  lineId: string,
  width: number,
  align: "center" | "left",
): void {
  const line = settings.customLines.find((row) => row.id === lineId);
  if (!line || !line.enabled || !line.text.trim()) return;
  const text = line.bold ? line.text.trim().toUpperCase() : line.text.trim();
  for (const w of wrapWords(text, width)) {
    out.push(align === "left" ? padRight(w, width).slice(0, width) : centerLine(w, width));
  }
}

/** Set per print job from thermal settings — keeps call sites simple. */
let activeShowCurrencyPrefix = false;

function formatMoney(pkr: number, compact = false, showRs = false): string {
  const digits = compact
    ? `${Math.round(pkr).toLocaleString("en-PK").replace(/,/g, "")}`
    : pkr.toLocaleString("en-PK");
  // Thermal receipts: numbers only by default (no "Rs" prefix).
  if (!(showRs || activeShowCurrencyPrefix)) return digits;
  return compact ? `Rs${digits}` : `Rs ${digits}`;
}

/**
 * Prefer branch thermal Custom mm over a stale profile preset.
 * Profile paperSize is used only when thermal is not set to custom.
 */
function resolvePaperSize(
  input: Pick<PrintTicketInput, "paperSize" | "branchCode">,
  thermal: ThermalPrintSettings,
): PrinterPaperSize {
  return resolveThermalPaperSize(input.paperSize, thermal);
}

function resolveThermalSettings(input: PrintTicketInput): ThermalPrintSettings {
  if (input.thermal) return normalizeThermalPrintSettings(input.thermal);
  if (input.branchCode) return loadThermalPrintSettings(input.branchCode);
  return DEFAULT_THERMAL_PRINT_SETTINGS;
}

function padRight(text: string, width: number): string {
  const t = text.slice(0, Math.max(0, width));
  return t + " ".repeat(Math.max(0, width - t.length));
}

function padLeft(text: string, width: number): string {
  const t = text.slice(0, Math.max(0, width));
  return " ".repeat(Math.max(0, width - t.length)) + t;
}

function centerLine(text: string, width: number): string {
  const t = text.slice(0, Math.max(0, width));
  const pad = Math.max(0, width - t.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + t + " ".repeat(pad - left);
}

/**
 * Column widths that always sum to `width` (gaps included).
 * Amount column is reserved first so totals never clip on the right.
 */
function receiptPlainColumns(
  width: number,
  wantPrice: boolean,
  amountSamples: string[],
): { qtyW: number; itemW: number; priceW: number; amtW: number; showPrice: boolean } {
  // "QTY" needs 3 chars; keep a dedicated gap so headers never read as QTYITEM.
  const qtyW = 3;
  const longestAmt = amountSamples.reduce((m, s) => Math.max(m, s.length), 3);
  const amtW = Math.min(Math.max(longestAmt, 4), Math.max(4, Math.floor(width * 0.28)));
  const minItem = Math.max(8, Math.floor(width * 0.35));
  const gapQtyItem = 1;
  const gapBeforeAmt = 1;

  let showPrice = wantPrice;
  let priceW = 0;
  let gapItemPrice = 0;

  const baseUsed = qtyW + gapQtyItem + gapBeforeAmt + amtW;
  let itemW = width - baseUsed;
  if (showPrice && itemW >= minItem + 1 + 5) {
    priceW = Math.min(7, Math.max(5, Math.floor((itemW - minItem) * 0.4)));
    gapItemPrice = 1;
    itemW = width - (qtyW + gapQtyItem + priceW + gapItemPrice + gapBeforeAmt + amtW);
  } else {
    showPrice = false;
    priceW = 0;
    itemW = width - baseUsed;
  }

  if (itemW < minItem) {
    showPrice = false;
    priceW = 0;
    itemW = width - (qtyW + gapQtyItem + gapBeforeAmt + amtW);
  }

  const used =
    qtyW + gapQtyItem + Math.max(itemW, 0) + (showPrice ? gapItemPrice + priceW : 0) + gapBeforeAmt + amtW;
  if (used !== width) {
    itemW = Math.max(6, itemW + (width - used));
  }

  return { qtyW, itemW: Math.max(6, itemW), priceW, amtW, showPrice };
}

/** Fixed-width receipt row with guaranteed single-space gaps between columns. */
function plainReceiptItemRow(
  qty: string,
  item: string,
  amount: string,
  cols: { qtyW: number; itemW: number; priceW: number; amtW: number; showPrice: boolean },
  price = "",
): string {
  const left = `${padRight(qty, cols.qtyW)} ${padRight(item, cols.itemW)}`;
  if (cols.showPrice) {
    return `${left} ${padLeft(price, cols.priceW)} ${padLeft(amount, cols.amtW)}`;
  }
  return `${left} ${padLeft(amount, cols.amtW)}`;
}

/** Label left, value right — value is never truncated. */
function plainLabelValueLine(label: string, value: string, width: number): string {
  const val = value.slice(0, Math.max(1, width - 4));
  const leftW = Math.max(1, width - val.length - 1);
  return `${padRight(label, leftW)} ${val}`;
}

/** Pakistani restaurant style: left text + right value on one line when possible. */
function pushPackedPair(out: string[], left: string, right: string, width: number): void {
  const L = left.replace(/\s+/g, " ").trim();
  const R = right.replace(/\s+/g, " ").trim();
  if (!L && !R) return;
  if (!R) {
    for (const w of wrapWords(L, width)) out.push(w);
    return;
  }
  if (!L) {
    out.push(padLeft(R, width));
    return;
  }
  if (L.length + 1 + R.length <= width) {
    out.push(padRight(L, width - R.length) + R);
    return;
  }
  const room = Math.max(4, width - R.length - 1);
  out.push(padRight(L.slice(0, room).trimEnd(), width - R.length) + R);
  const rest = L.slice(room).trim();
  if (rest) {
    for (const w of wrapWords(rest, width)) out.push(w);
  }
}

/** Join non-empty parts with a separator (fits common PK thermal meta lines). */
function joinMetaParts(parts: Array<string | false | null | undefined>, sep = " · "): string {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(sep);
}

/** Compact PK date/time for thermal (one line). */
function formatThermalPrintedAt(): string {
  return new Date().toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function wrapWords(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, width);
    }
  }
  if (current) lines.push(current);
  return lines;
}

function pushKotCustomLinePlain(
  out: string[],
  lines: KotCustomLine[],
  lineId: string,
  width: number,
  align: "center" | "left",
): void {
  const line = lines.find((row) => row.id === lineId);
  if (!line || !line.enabled || !line.text.trim()) return;
  const text = line.bold ? line.text.trim().toUpperCase() : line.text.trim();
  for (const w of wrapWords(text, width)) {
    out.push(align === "left" ? padRight(w, width).slice(0, width) : centerLine(w, width));
  }
}

/**
 * Kitchen ticket — classic slip with dotted/dashed rules (thermal ASCII).
 */
function buildKotThermalPlainText(
  input: PrintTicketInput,
  thermal: ThermalPrintSettings,
): string {
  const kot =
    input.kotSettings ??
    (input.branchCode ? loadKotPrintSettings(input.branchCode) : DEFAULT_KOT_PRINT_SETTINGS);
  const paper = resolvePaperSize(input, thermal);
  const width = thermalCharsPerLine(paper, thermal);
  const fields = kot.fields;
  const dash = "-".repeat(width);
  const out: string[] = [];
  const doubleDash = () => {
    out.push(dash);
    out.push(dash);
  };
  const align = kot.headerAlign === "left" ? ("left" as const) : ("center" as const);
  const pushAligned = (text: string) => {
    for (const w of wrapWords(text, width)) {
      out.push(align === "left" ? w : centerLine(w, width));
    }
  };
  const pushCustomsBetween = (afterId: string, beforeId: string) => {
    const order = kot.blockOrder;
    const a = order.indexOf(afterId);
    const b = order.indexOf(beforeId);
    if (a < 0 || b < 0 || b <= a) return;
    for (const id of order.slice(a + 1, b)) {
      if (!isKotSystemBlock(id)) pushKotCustomLinePlain(out, kot.customLines, id, width, align);
    }
  };

  const business = kot.headerBusinessName.trim() || input.branchName;
  if (fields.branchName) pushAligned(business.toUpperCase());
  if (fields.headerSubtitle && kot.headerSubtitle.trim()) {
    pushAligned(kot.headerSubtitle.trim());
  }
  doubleDash();
  const title = input.isOrderUpdate ? kot.documentTitleUpdate : kot.documentTitle;
  if (fields.documentTitle) pushAligned(title.toUpperCase());
  if (input.isOrderUpdate) {
    pushAligned("*** UPDATE REVISED ***");
  }
  pushCustomsBetween("documentTitle", "meta");

  const modeText = input.modeLabel.trim();
  const tableText = input.tableLabel?.trim() || "";
  const tableDistinct =
    Boolean(tableText) && tableText.toLowerCase() !== modeText.toLowerCase();
  const modeOut = kot.emphasizeOrderMeta ? modeText.toUpperCase() : modeText;
  const tableOut = kot.emphasizeOrderMeta ? tableText.toUpperCase() : tableText;

  const line1 = joinMetaParts([
    fields.orderRef ? input.orderRef : "",
    fields.orderType ? modeOut : "",
    tableDistinct && fields.tableLabel ? tableOut : "",
  ]);
  if (line1) {
    for (const w of wrapWords(line1, width)) out.push(w);
  }
  if (input.printerName?.trim()) {
    out.push(`Printer: ${input.printerName.trim()}`.slice(0, width));
  }
  pushCustomsBetween("meta", "notes");

  if (fields.notes && input.notes) {
    for (const w of wrapWords(`Note: ${input.notes}`, width)) out.push(w);
  }
  pushCustomsBetween("notes", "items");

  doubleDash();
  const showQty = fields.itemQty;
  const qtyW = 3;
  if (fields.itemHeaders) {
    out.push((showQty ? `${padRight("Qty", qtyW)} Name` : "Name").slice(0, width));
    out.push(dash);
  }

  for (const row of input.lines) {
    const nameWidth = showQty ? width - qtyW - 1 : width;
    const nameLines = wrapWords(row.label, Math.max(8, nameWidth));
    nameLines.forEach((part, idx) => {
      if (!showQty) {
        out.push(part.slice(0, width));
        return;
      }
      const qtyCol = idx === 0 ? padRight(String(row.qty), qtyW) : " ".repeat(qtyW);
      out.push(`${qtyCol} ${part}`.slice(0, width));
    });
    if (kot.itemUnderlineSeparator) out.push(dash);
  }

  pushCustomsBetween("items", "totals");
  out.push(dash);

  if (fields.itemTotals) {
    pushPackedPair(
      out,
      `Items ${input.lines.length}`,
      `Qty ${input.lines.reduce((s, l) => s + l.qty, 0)}`,
      width,
    );
    out.push(dash);
  }
  pushCustomsBetween("totals", "timestamp");

  if (fields.timestamp) {
    out.push(formatThermalPrintedAt().slice(0, width));
  }
  if (fields.waiterName && input.waiterName?.trim()) {
    out.push(`By ${input.waiterName.trim()}`.slice(0, width));
  }
  pushCustomsBetween("timestamp", "footer");

  if (fields.footer && kot.footerText.trim()) {
    out.push(dash);
    for (const line of kot.footerText.split(/\r?\n/)) {
      if (line.trim()) pushAligned(line.trim().toUpperCase());
    }
  }
  if (fields.footerSecondary && kot.footerSecondaryText.trim()) {
    for (const line of kot.footerSecondaryText.split(/\r?\n/)) {
      if (line.trim()) out.push(line.trim().slice(0, width));
    }
  }
  const order = kot.blockOrder;
  const a = Math.max(order.indexOf("footer"), order.indexOf("footerSecondary"));
  for (const id of order.slice(a + 1)) {
    if (!isKotSystemBlock(id)) pushKotCustomLinePlain(out, kot.customLines, id, width, align);
  }

  out.push("");
  return out.join("\n");
}

/**
 * Customer receipt — standard Pakistani / international thermal format.
 *
 *   BUSINESS NAME
 *   --------------------------------
 *            TAX INVOICE
 *   --------------------------------
 *   Date          25-Jul-2026 5:13 pm
 *   Invoice #     BILL-123
 *   Order #       ORD-7
 *   Type          Dine-in
 *   Cashier       Ali
 *   --------------------------------
 *   Qty Item                    Amt
 *     1 Chicken Biryani         450
 *   --------------------------------
 *   Subtotal                    450
 *   ================================
 *   TOTAL                       450
 *   ================================
 *        Thank you for visiting
 */
export function buildThermalPlainText(
  input: PrintTicketInput,
  thermalOverride?: ThermalPrintSettings,
): string {
  const thermal =
    thermalOverride ?? resolveThermalSettings(input);
  if (input.kind !== "receipt") {
    return buildKotThermalPlainText(input, thermal);
  }
  const paper = resolvePaperSize(input, thermal);
  const width = thermalCharsPerLine(paper, thermal);
  const compact = thermal.compactMoney;
  activeShowCurrencyPrefix = thermal.showCurrencyPrefix === true;
  const billSettings =
    input.billPrintSettings ??
    (input.branchCode
      ? resolveBillPrintSettingsForReceipt(input.branchCode)
      : DEFAULT_BILL_PRINT_SETTINGS);
  const fields = billSettings.fields;
  // Wide rolls use columns; Clear is for narrow rolls only.
  const useClearLayout = thermal.receiptLayout === "clear" && isNarrowPaperWidth(paper, thermal.customPaperWidthMm);
  const showPrice =
    !useClearLayout &&
    Boolean(fields.itemAmount) &&
    Boolean(thermal.showUnitPrice) &&
    !isNarrowPaperWidth(paper, thermal.customPaperWidthMm);
  const showAmt = Boolean(fields.itemAmount);
  const dash = "-".repeat(width);
  const equals = "=".repeat(width);
  const out: string[] = [];
  const pushRule = (kind: "dash" | "equals" = "dash") => {
    out.push(kind === "equals" ? equals : dash);
  };

  const business = billSettings.headerBusinessName.trim()
    ? billSettings.headerBusinessName.trim()
    : input.branchName;
  pushRule();
  if (fields.branchName !== false) {
    for (const w of wrapWords(business, width)) {
      out.push(centerLine(w, width));
    }
  }
  if (fields.headerSubtitle && billSettings.headerSubtitle.trim()) {
    for (const w of wrapWords(billSettings.headerSubtitle.trim(), width)) {
      out.push(centerLine(w, width));
    }
  }

  const plainAlign =
    billSettings.headerAlign === "left" ? ("left" as const) : ("center" as const);
  const pushCustomsBetween = (afterId: string, beforeId: string) => {
    const order = billSettings.blockOrder;
    const a = order.indexOf(afterId);
    const b = order.indexOf(beforeId);
    if (a < 0 || b < 0 || b <= a) return;
    for (const id of order.slice(a + 1, b)) {
      if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
    }
  };

  pushRule();
  const title = billSettings.documentTitle;
  if (fields.documentTitle !== false) {
    out.push(centerLine(title.toUpperCase(), width));
  }
  pushRule();
  pushCustomsBetween("documentTitle", "meta");

  const modeText = input.modeLabel.trim();
  const tableText = input.tableLabel?.trim() || "";
  const printedBy = staffNameForReceipt(input);
  const orderValue = [
    fields.orderRef !== false ? input.orderRef : "",
    fields.orderType !== false ? modeText : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Image layout: ORDER / TABLE as left label · right value
  if ((fields.orderRef !== false || fields.orderType !== false) && orderValue) {
    out.push(plainLabelValueLine("ORDER", orderValue, width));
  }
  if (fields.tableLabel !== false && tableText && tableText.toLowerCase() !== modeText.toLowerCase()) {
    out.push(plainLabelValueLine("TABLE", tableText, width));
  }
  if (fields.billRef !== false && input.billRef?.trim()) {
    out.push(plainLabelValueLine("BILL", input.billRef.trim(), width));
  }
  if (fields.waiterName !== false && printedBy) {
    out.push(plainLabelValueLine("CASHIER", printedBy, width));
  }
  const deliveryContact = resolveDeliveryPrintContact(input);
  if (deliveryContact.customerName) {
    out.push(plainLabelValueLine("CUSTOMER", deliveryContact.customerName, width));
  }
  if (deliveryContact.customerPhone) {
    out.push(plainLabelValueLine("PHONE", deliveryContact.customerPhone, width));
  }
  if (deliveryContact.customerAddress) {
    for (const w of wrapWords(`ADDRESS: ${deliveryContact.customerAddress}`, width)) out.push(w);
  }
  if (deliveryContact.riderName) {
    out.push(plainLabelValueLine("RIDER", deliveryContact.riderName, width));
  }
  pushCustomsBetween("meta", "notes");

  const plainNotes = receiptNotesWithoutPackedDeliveryContact(
    input.notes,
    hasStructuredDeliveryContact(deliveryContact),
  );
  if (plainNotes && fields.notes !== false) {
    for (const w of wrapWords(`Note: ${plainNotes}`, width)) out.push(w);
  }
  pushCustomsBetween("notes", "timestamp");

  if (fields.timestamp !== false) {
    const stamp = formatThermalPrintedAt();
    if (stamp) out.push(centerLine(stamp, width));
  }
  pushCustomsBetween("timestamp", "items");
  pushRule();

  if (showAmt && useClearLayout) {
    for (const row of input.lines) {
      const lineTotal = formatMoney(row.unitPrice * row.qty, compact);
      const rate = formatMoney(row.unitPrice, compact);
      for (const w of wrapWords(row.label, width)) out.push(w);
      pushPackedPair(out, `  ${row.qty} x ${rate}`, lineTotal, width);
    }
  } else if (showAmt) {
    const wantPrice = showPrice && width >= 36;
    const amountSamples = input.lines.map((row) => formatMoney(row.unitPrice * row.qty, compact));
    const cols = receiptPlainColumns(width, wantPrice, amountSamples);
    if (fields?.itemHeaders !== false) {
      out.push(
        plainReceiptItemRow(
          "QTY",
          "ITEM",
          "AMOUNT",
          cols,
          cols.showPrice ? "PRICE" : "",
        ),
      );
      pushRule();
    }
    for (const row of input.lines) {
      const amt = formatMoney(row.unitPrice * row.qty, compact);
      const price = formatMoney(row.unitPrice, compact);
      const qty = String(row.qty);
      const nameLines = wrapWords(row.label, cols.itemW);
      nameLines.forEach((name, idx) => {
        out.push(
          plainReceiptItemRow(
            idx === 0 ? qty : "",
            name,
            idx === 0 ? amt : "",
            cols,
            idx === 0 ? price : "",
          ),
        );
      });
    }
  } else {
    if (fields?.itemHeaders !== false) {
      out.push("QTY  ITEM");
      pushRule();
    }
    for (const row of input.lines) {
      for (const w of wrapWords(`${row.qty}  ${row.label}`, width)) out.push(w);
    }
  }

  {
    const order = billSettings.blockOrder;
    const a = order.indexOf("items");
    const b = order.indexOf("totals");
    if (a >= 0 && b > a) {
      for (const id of order.slice(a + 1, b)) {
        if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
      }
    }
  }

  if (fields) {
    pushRule();
    const pushTotal = (label: string, value: string) => {
      out.push(plainLabelValueLine(label, value, width));
    };
    if (fields.subtotal) pushTotal("Subtotal", formatMoney(input.subtotal, compact));
    if (fields.discount && input.discount > 0) {
      pushTotal(
        `Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}`,
        formatMoney(input.discount, compact),
      );
    }
    if (fields.service && input.service > 0) {
      pushTotal(`Service (${input.servicePct}%)`, formatMoney(input.service, compact));
    }
    if (fields.tax && input.tax > 0) {
      const taxLabel = input.praFiscal
        ? `Sales Tax (${input.taxPct ?? 0}%)`
        : `Tax (${input.taxPct ?? 0}%)`;
      pushTotal(taxLabel, formatMoney(input.tax, compact));
    }
    if (fields.delivery && (input.deliveryCharge ?? 0) > 0) {
      pushTotal("Delivery", formatMoney(input.deliveryCharge!, compact));
    }
    if (fields.total) {
      pushRule();
      pushTotal("Total", formatMoney(input.total, compact));
      pushRule();
    }
  }

  if (fields?.footer !== false) {
    pushRule();
    // Platform branding — always above Thank you; not part of user bill customization.
    const poweredBy = loadReceiptPoweredBy().trim();
    if (poweredBy) {
      for (const w of wrapWords(poweredBy, width)) {
        out.push(centerLine(w, width));
      }
    }
    const footer =
      (billSettings.footerText || "THANK YOU — VISIT AGAIN").trim() ||
      "THANK YOU — VISIT AGAIN";
    for (const w of wrapWords(footer, width)) {
      out.push(centerLine(w.toUpperCase(), width));
    }
    if (fields?.footerSecondary && billSettings.footerSecondaryText.trim()) {
      for (const w of wrapWords(billSettings.footerSecondaryText.trim(), width)) {
        out.push(centerLine(w, width));
      }
    }
  }
  {
    const order = billSettings.blockOrder;
    const a = Math.max(order.indexOf("footer"), order.indexOf("footerSecondary"));
    for (const id of order.slice(a + 1)) {
      if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
    }
  }
  out.push("");
  return out.join("\n");
}

export function buildTicketHtml(input: PrintTicketInput): string {
  const isReceipt = input.kind === "receipt";
  const kotSettings =
    input.kotSettings ??
    (input.branchCode ? loadKotPrintSettings(input.branchCode) : DEFAULT_KOT_PRINT_SETTINGS);
  const billSettings =
    input.billPrintSettings ??
    (input.branchCode
      ? resolveBillPrintSettingsForReceipt(input.branchCode)
      : DEFAULT_BILL_PRINT_SETTINGS);
  const thermal = resolveThermalSettings(input);
  const paperSize = resolvePaperSize(input, thermal);
  const narrowPaper = isNarrowPaperWidth(paperSize, thermal.customPaperWidthMm);
  const marginMm = thermal.marginMm;
  const contentWidthMm = thermalContentWidthMm(paperSize, marginMm, thermal.customPaperWidthMm);
  const moneyCompact = thermal.compactMoney;
  activeShowCurrencyPrefix = thermal.showCurrencyPrefix === true;
  const textScale =
    typeof input.textScale === "number" && input.textScale > 0 ? input.textScale : 1;
  const receiptFontsBase = billReceiptFontSizes(billSettings.baseFontSize);
  const receiptFonts =
    textScale === 1
      ? receiptFontsBase
      : (Object.fromEntries(
          Object.entries(receiptFontsBase).map(([k, v]) => [
            k,
            Math.max(8, Math.round(Number(v) * textScale)),
          ]),
        ) as typeof receiptFontsBase);
  const fields = isReceipt ? billSettings.fields : null;
  const isOrderUpdate = !isReceipt && Boolean(input.isOrderUpdate);
  const title = isReceipt
    ? billSettings.documentTitle
    : isOrderUpdate
      ? kotSettings.documentTitleUpdate
      : kotSettings.documentTitle;
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalItems = input.lines.length;
  const totalQty = input.lines.reduce((sum, line) => sum + line.qty, 0);

  // Pay / invoice receipt: columns on wide rolls; Clear only on narrow rolls.
  const useClearLayout =
    isReceipt && thermal.receiptLayout === "clear" && isNarrowPaperWidth(paperSize, thermal.customPaperWidthMm);
  const showAmtColEarly = isReceipt && Boolean(fields?.itemAmount);
  // Columns: Qty | Item | [Price] | Amt — Price when user enables it (columns layout, not narrow).
  const rollMm = paperWidthMm(paperSize, thermal.customPaperWidthMm);
  const showPriceCol =
    showAmtColEarly &&
    !useClearLayout &&
    !narrowPaper &&
    Boolean(thermal.showUnitPrice);

  const clearItemBlocks =
    useClearLayout && showAmtColEarly
      ? input.lines
          .map((line) => {
            const lineTotal = line.unitPrice * line.qty;
            return `<div class="clear-item">
        <div class="clear-item-main">
          <div class="clear-item-name">${escapeHtml(line.label)}</div>
          <div class="clear-item-qty">${escapeHtml(`${line.qty} × ${formatMoney(line.unitPrice, moneyCompact)}`)}</div>
        </div>
        <div class="clear-item-amt">${formatMoney(lineTotal, moneyCompact)}</div>
      </div>`;
          })
          .join("")
      : "";

  const lineRows = input.lines
    .map((line) => {
      const lineTotal = line.unitPrice * line.qty;
      const kotSepClass = !isReceipt && kotSettings.itemUnderlineSeparator ? ' class="kot-item-sep"' : "";
      if (!isReceipt) {
        return `<tr${kotSepClass}>
        <td class="item-line"><span class="qty">${line.qty}</span>&nbsp;&nbsp;<span class="item-name">${escapeHtml(line.label)}</span></td>
      </tr>`;
      }
      if (useClearLayout) return "";
      const showQty = fields!.itemQty;
      const showAmt = fields!.itemAmount;
      // Full-width grid row — column tracks sized from paper mm / user toggles (see itemGridCols).
      return `<div class="item-row">
        ${showQty ? `<span class="item-qty">${line.qty}</span>` : ""}
        <span class="item-name">${escapeHtml(line.label)}</span>
        ${showPriceCol ? `<span class="item-price">${formatMoney(line.unitPrice, moneyCompact)}</span>` : ""}
        ${showAmt ? `<span class="item-amt">${formatMoney(lineTotal, moneyCompact)}</span>` : ""}
      </div>`;
    })
    .join("");

  const totalsRows = isReceipt && fields
    ? [
        fields.subtotal
          ? `<div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(input.subtotal, moneyCompact)}</span></div>`
          : "",
        fields.discount &&
        ((input.discount > 0
          ? input.discount
          : discountAmountFromTicketNotes(input.notes, input.subtotal)) > 0)
          ? (() => {
              const disc =
                input.discount > 0
                  ? input.discount
                  : discountAmountFromTicketNotes(input.notes, input.subtotal);
              const pct =
                input.discountPct > 0
                  ? input.discountPct
                  : discountPctFromAmount(disc, input.subtotal);
              return `<div class="row"><span class="label">Discount${pct > 0 ? ` (${pct}%)` : ""}</span><span class="value discount">${formatMoney(disc, moneyCompact)}</span></div>`;
            })()
          : "",
        fields.service && input.service > 0
          ? `<div class="row"><span class="label">Service (${input.servicePct}%)</span><span class="value">${formatMoney(input.service, moneyCompact)}</span></div>`
          : "",
        fields.tax && input.tax > 0
          ? `<div class="row"><span class="label">${input.praFiscal ? "Sales Tax" : "Tax"} (${input.taxPct ?? 0}%)</span><span class="value">${formatMoney(input.tax, moneyCompact)}</span></div>`
          : "",
        fields.delivery && (input.deliveryCharge ?? 0) > 0
          ? `<div class="row"><span class="label">Delivery</span><span class="value">${formatMoney(input.deliveryCharge!, moneyCompact)}</span></div>`
          : "",
        fields.total
          ? `<div class="row grand"><span class="label">Total</span><span class="value">${formatMoney(input.total, moneyCompact)}</span></div>`
          : "",
      ].filter(Boolean)
    : [];

  const totalsBlock =
    isReceipt && totalsRows.length > 0 ? `<div class="totals">${totalsRows.join("")}</div>` : "";

  // Simple invoice (no PRA): Cash vs Card GST comparison + settled payment lines.
  const paymentSectionsHtml = (() => {
    if (!isReceipt || !fields) return "";
    const parts: string[] = [];

    if (!input.praFiscal) {
      const settings = loadPosSettings(input.branchCode);
      const mode = inferPosModeFromLabel(input.tableLabel || input.modeLabel || "");
      // Always use Settings for the Card vs Cash preview (never hardcode card=5%).
      const cashGstPct = effectiveTaxPctForMode(settings, mode, "cash");
      const cardGstPct = effectiveTaxPctForMode(settings, mode, "card");
      const delivery = Math.max(0, input.deliveryCharge ?? 0);
      const servicePct = effectiveServicePctForMode(settings, mode);
      // DiscPct/DiscRs in notes must reduce Net — same as POS totals (Option 16).
      const discount =
        (input.discount ?? 0) > 0
          ? input.discount
          : discountAmountFromTicketNotes(input.notes, input.subtotal ?? 0);
      const discountPct =
        (input.discountPct ?? 0) > 0
          ? input.discountPct
          : discountPctFromAmount(discount, input.subtotal ?? 0);
      const cashTotals = computeTicketTotals(
        input.subtotal ?? 0,
        discount,
        servicePct,
        cashGstPct,
        delivery,
      );
      const cardTotals = computeTicketTotals(
        input.subtotal ?? 0,
        discount,
        servicePct,
        cardGstPct,
        delivery,
      );
      const money = (n: number) => formatMoney(n, moneyCompact);
      // Match reference: side-by-side Card/Cash on 80mm+; stack only on narrow 58mm.
      const stackCompare = narrowPaper;
      const cardTitle = stackCompare ? "CARD PAYMENT" : "On Card Payment";
      const cashTitle = stackCompare ? "CASH PAYMENT" : "On Cash Payment";
      const midRows = (gstPct: number, gstAmt: number, serviceAmt: number) =>
        [
          `<div class="row"><span class="label">Sub Total</span><span class="value">${money(input.subtotal)}</span></div>`,
          discount > 0
            ? `<div class="row"><span class="label">Discount${discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span class="value discount">${money(discount)}</span></div>`
            : "",
          serviceAmt > 0
            ? `<div class="row"><span class="label">Service${servicePct > 0 ? ` (${servicePct}%)` : ""}</span><span class="value">${money(serviceAmt)}</span></div>`
            : "",
          delivery > 0
            ? `<div class="row"><span class="label">Delivery</span><span class="value">${money(delivery)}</span></div>`
            : "",
          gstPct > 0 || gstAmt > 0
            ? `<div class="row"><span class="label">GST (${gstPct}%)</span><span class="value">${money(gstAmt)}</span></div>`
            : "",
        ]
          .filter(Boolean)
          .join("");
      parts.push(`
      <div class="pay-compare${stackCompare ? " pay-compare-stack" : ""}">
        <div class="pay-compare-col">
          <div class="pay-compare-title">${cardTitle}</div>
          ${midRows(cardGstPct, cardTotals.tax, cardTotals.service)}
          <div class="row grand pay-net"><span class="label">Net Total</span><span class="value">${money(cardTotals.total)}</span></div>
        </div>
        <div class="pay-compare-col">
          <div class="pay-compare-title">${cashTitle}</div>
          ${midRows(cashGstPct, cashTotals.tax, cashTotals.service)}
          <div class="row grand pay-net"><span class="label">Net Total</span><span class="value">${money(cashTotals.total)}</span></div>
        </div>
      </div>`);
    }

    const payments = (input.payments ?? []).filter((p) => p.amount > 0);
    if (payments.length > 0) {
      const byMethod = new Map<PaymentMethod, number>();
      for (const p of payments) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      }
      const rows = [...byMethod.entries()]
        .map(
          ([method, amount]) =>
            `<div class="row"><span class="label">${escapeHtml(PAYMENT_METHOD_LABELS[method] ?? method)}</span><span class="value">${formatMoney(amount, moneyCompact)}</span></div>`,
        )
        .join("");
      const billTotal = Math.max(0, input.total ?? 0);
      const cashReceived = Math.max(
        0,
        input.cashReceived ?? parseCashReceivedFromNotes(input.notes) ?? 0,
      );
      const changeDue = cashReceived > billTotal ? cashReceived - billTotal : 0;
      const changeRows =
        cashReceived > billTotal
          ? `<div class="row"><span class="label">Cash Received</span><span class="value">${formatMoney(cashReceived, moneyCompact)}</span></div>
             <div class="row grand pay-change"><span class="label">Change Due</span><span class="value">${formatMoney(changeDue, moneyCompact)}</span></div>`
          : "";
      parts.push(
        `<div class="totals pay-settled"><div class="pay-settled-title">Payment</div>${rows}${changeRows}</div>`,
      );
    }

    return parts.join("");
  })();

  const metaRow = (label: string, value: string, emphasize = false, extraClass = "") => {
    const v = value.trim();
    if (!v) return "";
    return `<div class="meta-row${emphasize ? " meta-row-strong" : ""}${extraClass ? ` ${extraClass}` : ""}"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(v)}</span></div>`;
  };

  const receiptCashier = isReceipt ? staffNameForReceipt(input) : "";
  const deliveryContact = resolveDeliveryPrintContact(input);
  const receiptNotes = receiptNotesWithoutPackedDeliveryContact(
    input.notes,
    hasStructuredDeliveryContact(deliveryContact),
  );
  const metaRows = isReceipt && fields
    ? [
        // PRA invoice first — large & bold (Option 15).
        input.praFiscal?.invoiceNumber
          ? metaRow("PRA Invoice #", input.praFiscal.invoiceNumber, true, "meta-pra-invoice")
          : "",
        // Order number on its own line — large & clear for thermal print.
        fields.orderRef && input.orderRef?.trim()
          ? `<div class="meta-order-solo"><span class="meta-order-solo-label">Order</span><span class="meta-order-solo-value">${escapeHtml(input.orderRef.trim())}</span></div>`
          : "",
        fields.orderType ? metaRow("Type", input.modeLabel ?? "", true) : "",
        fields.tableLabel &&
        input.tableLabel?.trim() &&
        input.tableLabel.trim().toLowerCase() !== input.modeLabel.trim().toLowerCase()
          ? metaRow("Table", input.tableLabel, true)
          : "",
        fields.billRef ? metaRow("Bill", input.billRef ?? "", false, "meta-row-plain") : "",
        fields.waiterName ? metaRow("Cashier", receiptCashier, false, "meta-row-plain") : "",
        deliveryContact.customerName ? metaRow("Customer", deliveryContact.customerName, true) : "",
        deliveryContact.customerPhone ? metaRow("Phone", deliveryContact.customerPhone, true) : "",
        deliveryContact.customerAddress
          ? metaRow("Address", deliveryContact.customerAddress, true)
          : "",
        deliveryContact.riderName ? metaRow("Rider", deliveryContact.riderName, true) : "",
      ]
        .filter(Boolean)
        .join("")
    : (() => {
        const mode = input.modeLabel.trim();
        const table = input.tableLabel?.trim() || "";
        const showTable = Boolean(table) && table.toLowerCase() !== mode.toLowerCase();
        const orderRef = input.orderRef?.trim() || "";
        const detailChips = [
          mode ? `<span class="meta-chip meta-primary">${escapeHtml(mode)}</span>` : null,
          showTable ? `<span class="meta-chip meta-primary">${escapeHtml(table)}</span>` : null,
          input.billRef?.trim()
            ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef.trim())}</span>`
            : null,
          input.waiterName?.trim()
            ? `<span class="meta-chip">By: ${escapeHtml(input.waiterName.trim())}</span>`
            : null,
          deliveryContact.customerName
            ? `<span class="meta-chip">${escapeHtml(deliveryContact.customerName)}</span>`
            : null,
          deliveryContact.customerPhone
            ? `<span class="meta-chip">${escapeHtml(deliveryContact.customerPhone)}</span>`
            : null,
          deliveryContact.riderName
            ? `<span class="meta-chip">Rider: ${escapeHtml(deliveryContact.riderName)}</span>`
            : null,
          isOrderUpdate ? `<span class="meta-chip meta-update">UPDATE</span>` : null,
        ]
          .filter(Boolean)
          .join("");
        const orderLine = orderRef
          ? `<div class="meta-order-line"><span class="meta-chip meta-order-ref">${escapeHtml(orderRef)}</span></div>`
          : "";
        const detailLine = detailChips
          ? `<div class="meta-detail-line">${detailChips}</div>`
          : "";
        return `${orderLine}${detailLine}`;
      })();
  const kotUpdateBanner = isOrderUpdate
    ? `<div class="kot-update-banner">*** UPDATE REVISED ***</div>`
    : "";

  const kotTotalsBlock =
    !isReceipt && kotSettings.fields.itemTotals
      ? `<div class="kot-totals">
          <div class="row"><span class="label">Total items</span><span class="value">${totalItems}</span></div>
          <div class="row"><span class="label">Total quantity</span><span class="value">${totalQty}</span></div>
        </div>`
      : "";

  const emphasizeMeta = isReceipt || kotSettings.emphasizeOrderMeta;
  // 80mm keeps the bold kitchen look; 58mm must shrink or chips/items overflow the roll.
  const kotBaseRaw = narrowPaper
    ? Math.max(10, Math.round(kotSettings.baseFontSize * 0.7))
    : kotSettings.baseFontSize;
  const kotBase = Math.max(9, Math.round(kotBaseRaw * textScale));
  const bodyFontSize = !isReceipt ? kotBase : receiptFonts.body;
  const kotItemFont = kotBase + (narrowPaper ? 1 : 3);
  const kotQtyFont = kotBase + (narrowPaper ? 2 : 4);
  const kotMetaFont = emphasizeMeta ? kotBase + (narrowPaper ? 1 : 2) : kotBase;
  const kotBranchFont = kotBase + (narrowPaper ? 2 : 5);
  const kotDocFont = kotBase;
  const kotChipPad = narrowPaper ? "2px 5px" : "4px 8px";
  // Qty sits immediately before the item name (no wide QTY | ITEM gap).
  const kotItemAlign = "left";
  const compact = isReceipt && billSettings.layout === "compact";
  const headerAlign = isReceipt && billSettings.headerAlign === "left" ? "left" : "center";
  const showItemTable = !isReceipt || (!useClearLayout && (fields!.itemQty || fields!.itemAmount || input.lines.length > 0));
  const showClearItems = Boolean(clearItemBlocks);
  const showQtyCol = !isReceipt || fields!.itemQty;
  // Price/Amount are receipt-only — kitchen tickets never show pricing to kitchen staff.
  const showAmtCol = isReceipt && fields!.itemAmount;
  const showItemHeaders = !isReceipt || fields!.itemHeaders;
  // Column proportions match the reference receipt (QTY | ITEM | PRICE | AMOUNT).
  const itemColGapPx = narrowPaper ? 4 : 6;
  const itemGridCols = (() => {
    if (showPriceCol && showQtyCol && showAmtCol) {
      // Reference look: compact money cols on the right, ITEM fills the middle.
      return narrowPaper
        ? "12% minmax(0,1fr) 22% 24%"
        : rollMm >= 100
          ? "9% minmax(0,1fr) 16% 18%"
          : "10% minmax(0,1fr) 18% 20%";
    }
    if (showQtyCol && showAmtCol) {
      return narrowPaper ? "14% minmax(0,1fr) 28%" : "12% minmax(0,1fr) 24%";
    }
    if (showAmtCol) return "minmax(0,1fr) 28%";
    if (showQtyCol) return "12% minmax(0,1fr)";
    return "minmax(0,1fr)";
  })();
  const displayBusinessName =
    isReceipt && billSettings.headerBusinessName.trim()
      ? billSettings.headerBusinessName.trim()
      : !isReceipt && kotSettings.headerBusinessName.trim()
        ? kotSettings.headerBusinessName.trim()
        : input.branchName;
  const businessLogoSrc = isReceipt
    ? input.businessLogoSrc !== undefined
      ? input.businessLogoSrc
      : resolveBusinessLogoSrc(input.branchCode)
    : null;
  const businessLogoHtml = businessLogoSrc
    ? `<div class="business-logo-wrap" style="text-align:${headerAlign};"><img class="business-logo" src="${escapeHtml(businessLogoSrc)}" alt="" width="72" height="72" style="display:block;margin:4px auto 0;width:72px;height:72px;object-fit:contain;" onerror="this.parentElement.style.display='none'" /></div>`
    : "";
  const showHeaderSubtitle =
    isReceipt && fields!.headerSubtitle && billSettings.headerSubtitle.trim().length > 0;
  const showFooterPrimary = isReceipt && fields!.footer;
  const showFooterSecondary =
    isReceipt && fields!.footerSecondary && billSettings.footerSecondaryText.trim().length > 0;
  const showHeaderBlock =
    isReceipt &&
    fields &&
    (fields.branchName || fields.documentTitle || showHeaderSubtitle || Boolean(businessLogoSrc));
  /** KOT: show company once in header; date alone under meta (not branch code again). */
  const kotTimestampHtml = !isReceipt
    ? `<div class="timestamp">${escapeHtml(printedAt)}</div>`
    : "";

  const itemsHtml = showClearItems
    ? `<div class="clear-items">${clearItemBlocks}</div>`
    : showItemTable
      ? isReceipt
        ? `<div class="items-list${showAmtCol ? " has-amounts" : ""}${showPriceCol ? " has-price" : ""}">
    ${showItemHeaders
      ? `<div class="item-row item-head">
        ${showQtyCol ? '<span class="item-qty">QTY</span>' : ""}
        <span class="item-name">ITEM</span>
        ${showPriceCol ? '<span class="item-price">PRICE</span>' : ""}
        ${showAmtCol ? '<span class="item-amt">AMOUNT</span>' : ""}
      </div>`
      : ""}
    ${lineRows}
  </div>`
        : `<table class="items${showAmtCol ? " has-amounts" : ""}">
    ${showItemHeaders
      ? `<thead>
      <tr>
        ${showQtyCol ? '<th class="qty">QTY</th>' : ""}
        <th class="item">ITEM</th>
      </tr>
    </thead>`
      : ""}
    <tbody>${lineRows}</tbody>
  </table>`
      : "";

  const receiptBodyHtml = isReceipt && fields
    ? billSettings.blockOrder
        .map((blockId) => {
          if (!isBillSystemBlock(blockId)) {
            return renderCustomLineHtml(billSettings, blockId, headerAlign, receiptFonts.notes);
          }
          switch (blockId) {
            case "branchName":
              return fields.branchName || businessLogoHtml
                ? `<div class="receipt-brand" style="text-align:${headerAlign};">
                ${
                  fields.branchName
                    ? `<div class="branch-name${blockInkClass(billSettings, "branchName")}" style="text-align:${headerAlign};${blockStyleInline(billSettings, "branchName", receiptFonts.branchName)}">${escapeHtml(displayBusinessName)}</div>`
                    : ""
                }
                ${businessLogoHtml}
              </div>`
                : "";
            case "headerSubtitle":
              return showHeaderSubtitle
                ? `<div class="header-subtitle${blockInkClass(billSettings, "headerSubtitle")}" style="text-align:${headerAlign};${blockStyleInline(billSettings, "headerSubtitle", receiptFonts.headerSubtitle)}">${escapeHtml(billSettings.headerSubtitle.trim())}</div>`
                : "";
            case "documentTitle":
              return fields.documentTitle
                ? `<div class="doc-type${blockInkClass(billSettings, "documentTitle")}" style="text-align:${headerAlign};${blockStyleInline(billSettings, "documentTitle", receiptFonts.docType)}">${escapeHtml(title)}</div>`
                : "";
            case "meta":
              return metaRows
                ? `<div class="meta-block${blockInkClass(billSettings, "meta")}">${metaRows}</div>`
                : "";
            case "notes": {
              const noteText = isReceipt ? receiptNotes : input.notes?.trim();
              return fields.notes && noteText
                ? `<p class="notes${blockInkClass(billSettings, "notes")}" style="${blockStyleInline(billSettings, "notes", receiptFonts.notes)}">${escapeHtml(noteText)}</p>`
                : "";
            }
            case "timestamp":
              return fields.timestamp
                ? `<div class="timestamp${blockInkClass(billSettings, "timestamp")}" style="text-align:center;${blockStyleInline(billSettings, "timestamp", receiptFonts.timestamp)}">${escapeHtml(printedAt)}</div>`
                : "";
            case "items":
              // Do not put font-size on the wrapper — large block styles create a blank
              // strut/gap above the table that shows on thermal PNG print but not preview.
              return itemsHtml
                ? `<div class="items-wrap${blockInkClass(billSettings, "items")}">${itemsHtml}</div>`
                : "";
            case "totals": {
              const body = input.praFiscal
                ? `${totalsBlock}${paymentSectionsHtml}`
                : paymentSectionsHtml || totalsBlock;
              return body
                ? `<div class="totals-wrap${blockInkClass(billSettings, "totals")}">${body}</div>`
                : "";
            }
            case "footer":
              return showFooterPrimary
                ? `<div class="footer${blockInkClass(billSettings, "footer")}" style="text-align:${headerAlign};${blockStyleInline(billSettings, "footer", receiptFonts.footer)}">${
                    (() => {
                      const poweredBy = loadReceiptPoweredBy().trim();
                      const thankYou = escapeHtml(billSettings.footerText || "Thank you — visit again");
                      return [
                        poweredBy
                          ? `<div class="powered-by" style="font-size:${Math.max(9, receiptFonts.footer - 1)}px;font-weight:500;margin-bottom:4px;letter-spacing:0.02em;">${escapeHtml(poweredBy)}</div>`
                          : "",
                        `<div class="thank-you">${thankYou}</div>`,
                      ]
                        .filter(Boolean)
                        .join("");
                    })()
                  }</div>`
                : "";
            case "footerSecondary":
              return showFooterSecondary
                ? `<div class="footer-secondary${blockInkClass(billSettings, "footerSecondary")}" style="text-align:${headerAlign};${blockStyleInline(billSettings, "footerSecondary", receiptFonts.footerSecondary)}">${escapeHtml(billSettings.footerSecondaryText.trim())}</div>`
                : "";
            default:
              return "";
          }
        })
        .filter(Boolean)
        .join("\n  ")
    : "";

  const receiptCss = isReceipt
    ? `
    body.ticket-receipt {
      padding: ${compact ? "4px 2px 8px" : "6px 3px 10px"};
      line-height: 1.25;
      border-top: none;
      border-bottom: none;
    }
    body.ticket-receipt .branch-name {
      font-size: ${receiptFonts.branchName}px;
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.2;
      text-align: center;
      color: #000;
      padding: 2px 0 6px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    body.ticket-receipt .receipt-brand {
      text-align: center;
      width: 100%;
    }
    body.ticket-receipt .business-logo-wrap {
      margin: 0 auto 6px;
      text-align: center;
    }
    body.ticket-receipt .business-logo {
      display: block !important;
      width: 72px !important;
      height: 72px !important;
      margin: 4px auto 0 !important;
      object-fit: contain;
      image-rendering: auto;
    }
    body.ticket-receipt .header-subtitle {
      margin-top: 4px;
      font-size: ${receiptFonts.headerSubtitle}px;
      font-weight: 500;
      color: #000;
      text-align: center;
      line-height: 1.25;
    }
    body.ticket-receipt .doc-type {
      margin: 0;
      padding: 4px 0;
      font-size: ${receiptFonts.docType}px;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-align: center;
      color: #000;
      border-bottom: 1.5px solid #000;
    }
    body.ticket-receipt .meta-block { margin: 2px 0 0; padding: 0; }
    body.ticket-receipt .meta-order-solo {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin: 2px 0 6px;
      padding: 4px 0 6px;
      border-bottom: 1px dashed #000;
    }
    body.ticket-receipt .meta-order-solo-label {
      flex: 0 0 auto;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: ${Math.max(13, receiptFonts.metaChip - 1)}px;
      color: #000;
    }
    body.ticket-receipt .meta-order-solo-value {
      flex: 1 1 auto;
      text-align: right;
      font-weight: 400;
      font-size: ${Math.max(22, receiptFonts.metaChipBillRef + 4)}px;
      letter-spacing: 0.03em;
      color: #000;
      white-space: nowrap;
    }
    body.ticket-receipt .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      margin: 0;
      padding: 2px 0;
      font-size: ${receiptFonts.metaChip}px;
      line-height: 1.25;
      min-height: 0;
    }
    body.ticket-receipt .meta-label {
      flex: 0 0 auto;
      font-weight: 400;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: ${Math.max(14, receiptFonts.metaChip - 1)}px;
    }
    body.ticket-receipt .meta-value {
      flex: 1 1 auto;
      text-align: right;
      font-weight: 400;
      color: #000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body.ticket-receipt .meta-row-plain .meta-label,
    body.ticket-receipt .meta-row-plain .meta-value {
      font-weight: 400;
    }
    body.ticket-receipt .meta-row-strong .meta-value {
      font-weight: 400;
      font-size: ${receiptFonts.metaChipBillRef}px;
      white-space: nowrap;
    }
    body.ticket-receipt .meta-pra-invoice {
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
      margin: 2px 0 8px;
      padding: 4px 0 6px;
      border-bottom: 1px dashed #000;
    }
    body.ticket-receipt .meta-pra-invoice .meta-label {
      font-size: ${Math.max(14, receiptFonts.metaChip)}px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      width: 100%;
    }
    body.ticket-receipt .meta-pra-invoice .meta-value {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      word-break: break-all;
      overflow-wrap: anywhere;
      line-height: 1.25;
      font-size: ${Math.max(26, receiptFonts.metaChipBillRef + 6)}px !important;
      font-weight: 700;
      letter-spacing: 0;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
      width: 100%;
      text-align: left;
    }
    body.ticket-receipt .pay-change .value {
      font-weight: 700;
    }
    body.ticket-receipt .notes {
      text-align: center;
      margin: 4px 0 6px;
      font-size: ${receiptFonts.notes}px;
      color: #000;
      font-style: italic;
    }
    body.ticket-receipt .timestamp {
      text-align: center;
      margin: 4px 0 0;
      padding: 0 0 3px;
      border-bottom: 1px dashed #000;
      font-size: ${receiptFonts.timestamp}px;
      font-weight: 500;
      color: #000;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1.2;
    }
    body.ticket-receipt .items-wrap {
      margin: 2px 0 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      font-size: inherit;
      line-height: 0; /* kill wrapper strut — list sets its own line-height */
    }
    body.ticket-receipt .totals-wrap {
      margin: 2px 0 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      font-size: inherit;
      line-height: 0;
    }
    body.ticket-receipt .totals-wrap > * {
      line-height: 1.25;
    }
    /* Items: full paper width; QTY / PRICE / AMT tracks scale with assigned mm. */
    body.ticket-receipt .items-list {
      margin: 2px 0 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      line-height: 1.2;
      font-size: ${receiptFonts.itemName}px;
    }
    body.ticket-receipt .item-row {
      display: grid;
      grid-template-columns: ${itemGridCols};
      column-gap: ${itemColGapPx}px;
      align-items: baseline;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: ${compact ? "3px 0" : "4px 0"};
      border-bottom: 1px dashed #000;
      line-height: 1.25;
    }
    body.ticket-receipt .item-row:last-child {
      border-bottom: 1px solid #000;
    }
    body.ticket-receipt .item-row.item-head {
      padding: 6px 0 5px;
      border-bottom: 1px dashed #000;
      font-size: ${receiptFonts.th}px;
      font-weight: 400;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #000;
    }
    body.ticket-receipt .item-qty {
      font-size: ${receiptFonts.qty}px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #000;
      text-align: left;
      white-space: nowrap;
    }
    body.ticket-receipt .item-row.item-head .item-qty {
      font-size: ${receiptFonts.th}px;
    }
    body.ticket-receipt .item-name {
      min-width: 0;
      font-size: ${receiptFonts.itemName}px;
      font-weight: 400;
      color: #000;
      overflow-wrap: break-word;
      word-break: normal;
      text-align: left;
    }
    body.ticket-receipt .item-row.item-head .item-name {
      font-size: ${receiptFonts.th}px;
      font-weight: 400;
    }
    body.ticket-receipt .item-price,
    body.ticket-receipt .item-amt {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      text-align: right;
      color: #000;
    }
    body.ticket-receipt .item-price {
      font-size: ${receiptFonts.amt}px;
      font-weight: 400;
    }
    body.ticket-receipt .item-amt {
      font-size: ${receiptFonts.amt}px;
      font-weight: 400;
    }
    body.ticket-receipt .item-row.item-head .item-price,
    body.ticket-receipt .item-row.item-head .item-amt {
      font-size: ${receiptFonts.th}px;
      font-weight: 400;
    }
    body.ticket-receipt .totals { border-top: none; padding-top: 4px; margin-top: 0; }
    body.ticket-receipt .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      margin: 1px 0;
    }
    body.ticket-receipt .row .label {
      font-size: ${receiptFonts.rowLabel}px;
      font-weight: 400;
      color: #000;
    }
    body.ticket-receipt .row .value {
      font-size: ${receiptFonts.rowValue}px;
      font-weight: 400;
      color: #000;
    }
    body.ticket-receipt .row.grand {
      margin-top: 6px;
      padding: 4px 0;
      border-top: 1px solid #000;
      border-bottom: none;
      background: transparent;
    }
    body.ticket-receipt .row.grand .label,
    body.ticket-receipt .row.grand .value {
      color: #000;
      font-size: ${receiptFonts.grandValue}px;
      font-weight: 400;
    }
    /* Net Total must stay same size as other totals rows (do not enlarge). */
    body.ticket-receipt .row.grand.pay-net .label {
      font-size: ${receiptFonts.rowLabel}px;
      font-weight: 400;
    }
    body.ticket-receipt .row.grand.pay-net .value {
      font-size: ${receiptFonts.rowValue}px;
      font-weight: 400;
    }
    body.ticket-receipt .footer {
      margin-top: ${compact ? "6px" : "8px"};
      padding: 6px 0 4px;
      border-top: 1px dashed #000;
      border-bottom: 1px solid #000;
      font-size: ${receiptFonts.footer}px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #000;
      text-align: center;
    }
    body.ticket-receipt .footer-secondary {
      margin-top: 6px;
      font-size: ${receiptFonts.footerSecondary}px;
      color: #000;
      text-align: center;
    }
    body.ticket-receipt .custom-line { margin: 1px 0; font-size: ${receiptFonts.notes}px; color: #000; white-space: pre-wrap; }
    body.ticket-receipt .custom-line-bold { font-weight: 400; color: #000; }
    body.ticket-receipt .ink-custom,
    body.ticket-receipt .ink-custom .meta-label,
    body.ticket-receipt .ink-custom .meta-value,
    body.ticket-receipt .ink-custom thead th,
    body.ticket-receipt .ink-custom td,
    body.ticket-receipt .ink-custom .row .label,
    body.ticket-receipt .ink-custom .row .value { color: inherit !important; }
    body.ticket-receipt .ink-custom .meta-label,
    body.ticket-receipt .ink-custom .row .label { opacity: 1; }
    body.ticket-receipt .clear-items { margin: 2px 0 8px; }
    body.ticket-receipt .clear-item {
      display: flex; justify-content: space-between; gap: 10px;
      margin: 0 0 8px; padding-bottom: 7px; border-bottom: 1px dashed #000;
    }
    body.ticket-receipt .clear-item:last-child { border-bottom: 1px solid #000; }
    body.ticket-receipt .clear-item-main { flex: 1 1 auto; min-width: 0; }
    body.ticket-receipt .clear-item-name { font-size: ${receiptFonts.itemName}px; font-weight: 400; color: #000; }
    body.ticket-receipt .clear-item-qty { margin-top: 2px; font-size: ${receiptFonts.amt}px; color: #000; }
    body.ticket-receipt .clear-item-amt { font-size: ${Math.max(receiptFonts.amt, 12)}px; font-weight: 400; color: #000; white-space: nowrap; }
  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(input.orderRef)}${input.printerName ? ` · ${escapeHtml(input.printerName)}` : ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      scrollbar-width: none;
    }
    *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: ${bodyFontSize}px;
      font-weight: 700;
      line-height: ${narrowPaper ? "1.2" : "1.25"};
      color: #000;
      background: #fff;
      margin: 0;
      padding: ${narrowPaper ? "3px 2px 6px" : "6px 3px 10px"};
      /* Fill the preview / raster canvas edge-to-edge (mm width left empty bands on paper). */
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: unset;
      font-smooth: never;
      text-rendering: geometricPrecision;
    }
    .header {
      text-align: center;
      padding-bottom: ${narrowPaper ? "6px" : "12px"};
      border-bottom: 1.5px solid #000;
      margin-bottom: ${narrowPaper ? "6px" : "12px"};
    }
    .branch-name {
      font-size: ${isReceipt ? receiptFonts.branchName : kotBranchFont}px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: #000;
    }
    .doc-type {
      margin-top: ${narrowPaper ? "3px" : "6px"};
      font-size: ${isReceipt ? receiptFonts.docType : kotDocFont}px;
      font-weight: 700;
      letter-spacing: ${narrowPaper ? "0.06em" : "0.1em"};
      text-transform: uppercase;
      color: #000;
    }
    .header-subtitle {
      margin-top: 4px;
      font-size: ${receiptFonts.headerSubtitle}px;
      font-weight: 500;
      color: #000;
      line-height: 1.25;
    }
    .meta {
      margin: ${narrowPaper ? "6px 0 8px" : "12px 0 14px"};
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: center;
      gap: ${narrowPaper ? "6px" : "8px"};
      justify-content: center;
    }
    .meta-order-line {
      width: 100%;
      text-align: center;
    }
    .meta-detail-line {
      display: flex;
      flex-wrap: wrap;
      gap: ${narrowPaper ? "3px 4px" : "4px 6px"};
      justify-content: center;
      width: 100%;
    }
    .meta-chip {
      display: inline-block;
      max-width: 100%;
      font-size: ${isReceipt ? receiptFonts.metaChip : kotBase}px;
      font-weight: 500;
      color: #000;
      background: transparent;
      border-radius: 4px;
      padding: ${narrowPaper ? "2px 4px" : "3px 7px"};
      line-height: 1.3;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .meta-chip.bill-ref {
      font-weight: 600;
      color: #000;
      background: transparent;
    }
    .meta-chip.meta-order-ref {
      font-size: ${isReceipt ? receiptFonts.metaChip : kotBase + (narrowPaper ? 7 : 10)}px;
      font-weight: 400;
      color: #000;
      background: #facc15;
      border: ${narrowPaper ? "1px" : "1.5px"} solid #000;
      border-radius: 2px;
      padding: ${narrowPaper ? "5px 12px" : "8px 16px"};
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow-wrap: normal;
      word-break: keep-all;
    }
    .meta-chip.meta-primary {
      font-size: ${isReceipt ? (emphasizeMeta ? receiptFonts.metaChip + 2 : receiptFonts.metaChip) : kotMetaFont}px;
      font-weight: 700;
      color: #000;
      background: #facc15;
      border: ${narrowPaper ? "1px" : "1.5px"} solid #000;
      border-radius: 2px;
      padding: ${kotChipPad};
      /* Keep Takeaway / Table on one line — never split after the hyphen. */
      white-space: nowrap;
      overflow-wrap: normal;
      word-break: keep-all;
      flex-shrink: 0;
    }
    .notes {
      margin: ${narrowPaper ? "-2px 0 6px" : "-6px 0 12px"};
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.notes : kotBase}px;
      font-style: italic;
      color: #000;
    }
    .timestamp {
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.timestamp : Math.max(9, kotBase - 1)}px;
      font-weight: 500;
      color: #000;
      margin-bottom: ${isReceipt ? "0" : narrowPaper ? "6px" : "14px"};
      letter-spacing: 0.02em;
    }
    table {
      width: ${isReceipt ? "auto" : "100%"};
      max-width: 100%;
      border-collapse: collapse;
      margin: 0 0 ${narrowPaper ? "6px" : "10px"};
      table-layout: ${isReceipt ? "auto" : "fixed"};
    }
    thead th {
      font-size: ${isReceipt ? receiptFonts.th : Math.max(9, kotBase - 1)}px;
      font-weight: 700;
      letter-spacing: ${isReceipt ? "0.02em" : "0.04em"};
      text-transform: uppercase;
      color: #000;
      padding: 0 0 ${narrowPaper ? "3px" : "6px"};
      border-bottom: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.qty {
      width: 1%;
      text-align: left;
      padding-left: 0;
      padding-right: ${narrowPaper ? "6px" : "8px"};
      white-space: nowrap;
    }
    thead th.item { text-align: left; width: auto; padding-left: ${narrowPaper ? "2px" : "6px"}; }
    thead th.price { width: ${showPriceCol ? "1%" : "0"}; text-align: right; padding-left: 8px; white-space: nowrap; }
    thead th.amt {
      width: 1%;
      text-align: right;
      padding-left: 8px;
      white-space: nowrap;
    }
    tbody td {
      padding: 5px 0;
      vertical-align: top;
      border-bottom: 1px solid #f3f4f6;
    }
    tbody tr:last-child td { border-bottom: none; }
    /* KOT: kitchen slip — qty immediately before item (no wide gap) */
    body.ticket-kot .header {
      border-bottom: 1.5px solid #000;
      padding-bottom: ${narrowPaper ? "5px" : "8px"};
      margin-bottom: ${narrowPaper ? "6px" : "10px"};
    }
    body.ticket-kot .doc-type {
      margin-top: ${narrowPaper ? "3px" : "6px"};
      padding-top: 0;
      border-top: none;
      letter-spacing: ${narrowPaper ? "0.08em" : "0.14em"};
      font-weight: 700;
    }
    body.ticket-kot .meta {
      justify-content: center;
      margin: ${narrowPaper ? "5px 0 6px" : "8px 0 10px"};
      gap: ${narrowPaper ? "4px" : "6px"};
    }
    body.ticket-kot .timestamp {
      margin-bottom: 0;
      color: #000;
      font-weight: 600;
    }
    body.ticket-kot .kot-mid-space {
      height: ${narrowPaper ? "5px" : "8px"};
      margin: 0 0 ${narrowPaper ? "2px" : "4px"};
      border-bottom: 1.5px solid #000;
    }
    body.ticket-kot table.items {
      margin: 0;
      width: 100%;
      table-layout: auto;
    }
    body.ticket-kot thead th {
      padding: ${narrowPaper ? "4px 0 3px" : "6px 0 5px"};
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      color: #000;
      font-weight: 800;
      text-align: left;
    }
    body.ticket-kot thead th.item-line {
      text-align: left;
    }
    body.ticket-kot td.item-line {
      text-align: left;
      font-weight: 800;
      width: 100%;
    }
    body.ticket-kot td.item-line .qty {
      display: inline;
      font-weight: 900;
      font-size: ${kotQtyFont}px;
      margin-right: 0.65em;
      padding-right: 2px;
      white-space: nowrap;
    }
    body.ticket-kot td.item-line .item-name {
      display: inline;
      font-weight: 800;
      font-size: ${kotItemFont}px;
      text-align: left;
    }
    body.ticket-kot tbody td {
      padding: ${narrowPaper ? "5px 0" : "8px 0"};
      border-bottom: 1px solid #000;
      line-height: 1.25;
      vertical-align: middle;
      color: #000;
    }
    body.ticket-kot tbody tr:last-child td {
      border-bottom: 1.5px solid #000;
    }
    body.ticket-kot tbody tr.kot-item-sep td {
      border-bottom: 1px solid #000;
      padding: ${narrowPaper ? "5px 0" : "8px 0"};
    }
    body.ticket-kot .kot-totals {
      margin: ${narrowPaper ? "6px 0 2px" : "10px 0 4px"};
      padding-top: ${narrowPaper ? "5px" : "8px"};
      border-top: 1px dashed #000;
    }
    body.ticket-kot .footer {
      margin-top: ${narrowPaper ? "8px" : "12px"};
      padding-top: 0;
      border-top: none;
    }
    body.ticket-kot .kot-banner {
      margin-top: ${narrowPaper ? "6px" : "8px"};
      padding: ${narrowPaper ? "6px 4px" : "10px 8px"};
      border: ${narrowPaper ? "1.5px" : "2.5px"} solid #000;
      font-weight: 800;
      letter-spacing: ${narrowPaper ? "0.04em" : "0.08em"};
    }
    td.item-name {
      font-size: ${isReceipt ? (narrowPaper ? Math.max(11, receiptFonts.itemName - 1) : receiptFonts.itemName) : kotItemFont}px;
      font-weight: ${isReceipt ? "700" : "800"};
      color: #000;
      text-align: ${isReceipt ? "left" : kotItemAlign};
      padding-left: ${isReceipt ? (narrowPaper ? "2px" : "6px") : "0"};
      padding-right: ${isReceipt ? "4px" : "0"};
      overflow-wrap: break-word;
      word-break: normal;
      line-height: 1.25;
      vertical-align: top;
    }
    td.qty {
      width: ${narrowPaper ? "14%" : "12%"};
      text-align: left !important;
      font-size: ${isReceipt ? receiptFonts.qty : kotQtyFont}px;
      font-weight: 700;
      color: #000;
      font-variant-numeric: tabular-nums;
      padding-left: 0;
      padding-right: ${narrowPaper ? "6px" : "8px"};
      white-space: nowrap;
      vertical-align: top;
    }
    td.price {
      text-align: right;
      white-space: nowrap;
      font-size: ${receiptFonts.amt}px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #000;
      padding-right: 2px;
      vertical-align: top;
    }
    td.amt {
      text-align: right;
      white-space: nowrap;
      font-size: ${receiptFonts.amt}px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      padding-left: 4px;
      padding-right: 0;
      overflow: visible;
      color: #000;
      vertical-align: top;
    }
    .totals {
      border-top: 1.5px solid #000;
      padding-top: 8px;
      margin-top: 4px;
    }
    .pay-compare {
      display: flex;
      flex-direction: row;
      gap: ${narrowPaper ? "6px" : "8px"};
      border-top: none;
      margin-top: 8px;
      padding-top: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    /* Narrow 58mm only: stack full-width. 80mm+ keeps side-by-side like the reference. */
    .pay-compare.pay-compare-stack {
      flex-direction: column;
      gap: 6px;
    }
    .pay-compare-col {
      flex: 1 1 50%;
      min-width: 0;
      width: auto;
      border: 1px solid #000;
      padding: ${narrowPaper ? "4px 3px 3px" : "5px 4px 4px"};
      box-sizing: border-box;
      overflow: visible;
    }
    .pay-compare.pay-compare-stack .pay-compare-col {
      flex: 0 0 auto;
      width: 100%;
    }
    .pay-compare-title {
      font-size: ${Math.max(10, (isReceipt ? receiptFonts.rowLabel : kotBase) - (narrowPaper ? 1 : 1))}px;
      font-weight: ${isReceipt ? 400 : 600};
      text-align: center;
      margin-bottom: 4px;
      border-bottom: 1px dashed #000;
      padding-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pay-compare.pay-compare-stack .pay-compare-title {
      font-size: ${Math.max(12, isReceipt ? receiptFonts.rowLabel : kotBase)}px;
      letter-spacing: 0.04em;
      white-space: normal;
      overflow: visible;
      text-overflow: unset;
    }
    .pay-compare-col .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: nowrap;
      gap: 6px;
      margin: 2px 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    .pay-compare-col .row .label {
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pay-compare-col .row .value {
      flex: 0 0 auto;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      text-align: right;
      max-width: 55%;
      overflow: hidden;
    }
    .pay-compare-col .row.pay-net {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #000;
      align-items: center;
    }
    .pay-compare-col .row.pay-net .label {
      font-weight: ${isReceipt ? 400 : 700};
      white-space: nowrap;
      flex: 0 0 auto;
    }
    .pay-compare-col .row.pay-net .value {
      font-weight: ${isReceipt ? 400 : 700};
      font-size: ${isReceipt ? receiptFonts.rowValue : kotBase}px;
      margin-left: auto;
      max-width: none;
    }
    .pay-settled {
      margin-top: 8px;
      border-top: 1px dashed #000;
      padding-top: 6px;
    }
    .pay-settled-title {
      font-weight: 400;
      font-size: ${isReceipt ? receiptFonts.rowLabel : kotBase}px;
      margin-bottom: 4px;
      text-align: center;
    }
    .pay-settled .row .label,
    .pay-settled .row .value {
      font-weight: 400;
      font-size: ${isReceipt ? receiptFonts.rowValue : kotBase}px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 1px 0;
      gap: 6px;
      max-width: 100%;
    }
    .row .label {
      font-size: ${isReceipt ? receiptFonts.rowLabel : kotBase}px;
      font-weight: 500;
      color: #000;
      min-width: 0;
      flex: 1 1 auto;
      overflow: visible;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.25;
    }
    .row .value {
      font-size: ${isReceipt ? receiptFonts.rowValue : kotBase + 1}px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #000;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      flex: 0 1 auto;
      max-width: 58%;
      text-align: right;
      line-height: 1.25;
    }
    .row .value.discount { color: #dc2626; }
    .row.grand {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
    }
    .row.grand .label {
      font-size: ${receiptFonts.grandLabel}px;
      font-weight: 700;
      color: #000;
      letter-spacing: -0.01em;
    }
    .row.grand .value {
      font-size: ${receiptFonts.grandValue}px;
      font-weight: 700;
      color: #000;
      letter-spacing: -0.02em;
    }
    .row.grand.pay-net .label {
      font-size: ${receiptFonts.rowLabel}px;
      font-weight: ${isReceipt ? 400 : 700};
      letter-spacing: normal;
    }
    .row.grand.pay-net .value {
      font-size: ${receiptFonts.rowValue}px;
      font-weight: ${isReceipt ? 400 : 700};
      letter-spacing: normal;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.footer : kotBase}px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #000;
    }
    .footer-secondary {
      margin-top: 6px;
      font-size: ${receiptFonts.footerSecondary}px;
      font-weight: 400;
      letter-spacing: 0.02em;
      text-transform: none;
      color: #000;
      line-height: 1.4;
    }
    .kot-banner {
      margin-top: 8px;
      text-align: center;
      font-size: ${kotBase}px;
      font-weight: 800;
      letter-spacing: ${narrowPaper ? "0.04em" : "0.08em"};
      text-transform: uppercase;
      color: #000;
      border: ${narrowPaper ? "1.5px" : "2px"} solid #111827;
      padding: ${narrowPaper ? "6px 4px" : "8px 10px"};
    }
    .kot-banner.kot-banner-update {
      border-width: 2px;
      letter-spacing: 0.12em;
    }
    .meta-chip.meta-update {
      font-weight: 700;
      letter-spacing: 0.08em;
      border: 1.5px solid #111827;
      background: #111827;
      color: #fff;
    }
    .kot-update-banner {
      margin: 6px 0 8px;
      text-align: center;
      font-size: ${kotBase + (narrowPaper ? 1 : 2)}px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #000;
      border: 2px solid #111827;
      padding: ${narrowPaper ? "5px 4px" : "7px 8px"};
    }
    .kot-totals {
      border-top: 1px dashed #9ca3af;
      padding-top: 8px;
      margin: 8px 0 4px;
    }
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        padding: 0 1px;
        width: ${contentWidthMm}mm;
        max-width: ${contentWidthMm}mm;
        overflow-x: hidden;
        margin: 0 auto;
      }
      .meta-chip.meta-primary,
      .meta-chip.meta-order-ref {
        background: #facc15 !important;
        border: 1.5px solid #000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        margin: ${Math.max(2, marginMm)}mm;
        size: ${
          paperSize === "A4"
            ? "A4 portrait"
            : `${paperWidthMm(paperSize, thermal.customPaperWidthMm)}mm 297mm`
        };
      }
    }
    ${receiptCss}
    ${isReceipt ? PRA_RECEIPT_FOOTER_CSS : ""}
  </style>
</head>
<body class="${isReceipt ? "ticket-receipt" : "ticket-kot"}">
  ${
    isReceipt
      ? receiptBodyHtml
      : `${showHeaderBlock
    ? `<header class="header">
    ${fields!.branchName ? `<div class="branch-name">${escapeHtml(displayBusinessName)}</div>` : ""}
    ${showHeaderSubtitle ? `<div class="header-subtitle">${escapeHtml(billSettings.headerSubtitle.trim())}</div>` : ""}
    ${fields!.documentTitle ? `<div class="doc-type">${escapeHtml(title)}</div>` : ""}
  </header>`
    : `<header class="header">
    <div class="branch-name">${escapeHtml(displayBusinessName)}</div>
    <div class="doc-type">${escapeHtml(title)}</div>
  </header>`}
  ${metaRows ? `<div class="meta">${metaRows}</div>` : ""}
  ${kotUpdateBanner}
  ${input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : ""}
  ${kotTimestampHtml}
  <div class="kot-mid-space" aria-hidden="true"></div>
  ${showItemTable
    ? `<table class="items">
    <thead>
      <tr>
        <th class="item-line">QTY ITEM</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>`
    : ""}
  ${kotTotalsBlock}
  <div class="footer"><div class="kot-banner${isOrderUpdate ? " kot-banner-update" : ""}">${
    isOrderUpdate ? "Kitchen copy — UPDATE REVISED" : "Kitchen copy — order"
  }</div></div>`
  }
  ${isReceipt && input.praFiscal ? buildPraReceiptFooterHtml(input.praFiscal) : ""}
</body>
</html>`;
}

/** Strip HTML to plain text suitable for thermal / ESC-POS spooler jobs. */
export function htmlToPlainText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const cleaned = body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6]|li)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<hr[^>]*>/gi, "\n--------------------------------\n");
  const tmp = document.createElement("div");
  tmp.innerHTML = cleaned;
  return (tmp.textContent || tmp.innerText || "")
    .replace(/\t+/g, "  ")
    .replace(/[ \t]+\n/g, "\n")
    // Compact thermal output — no large blank gaps between item lines
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Serialize OS print dialogs. Overlapping `window.print()` calls (KOT then receipt,
 * or multiple copies) leave Cancel stuck in WebView2 / Chromium.
 */
let printDialogChain: Promise<void> = Promise.resolve();

function enqueuePrintDialog<T>(run: () => Promise<T>): Promise<T> {
  const next = printDialogChain.then(run, run);
  printDialogChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Open the system print dialog and wait until it closes (Print or Cancel).
 * Resolves true when the dialog opened; false if the iframe could not be created.
 */
export function printHtmlDocumentAndWait(
  html: string,
  docTitle?: string,
): Promise<boolean> {
  return enqueuePrintDialog(
    () =>
      new Promise<boolean>((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("title", "print");
        iframe.style.cssText =
          "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
        document.body.appendChild(iframe);

        const win = iframe.contentWindow;
        const doc = win?.document;
        if (!win || !doc) {
          iframe.remove();
          resolve(false);
          return;
        }

        doc.open();
        doc.write(html);
        doc.close();
        if (docTitle) {
          doc.title = docTitle;
        }

        let settled = false;
        let dialogOpened = false;
        let safetyTimer: ReturnType<typeof setTimeout> | undefined;
        let focusTimer: ReturnType<typeof setTimeout> | undefined;

        const cleanupListeners = (): void => {
          window.removeEventListener("focus", onWindowFocus);
          try {
            win.onafterprint = null;
          } catch {
            /* ignore */
          }
        };

        const finish = (): void => {
          if (settled) return;
          settled = true;
          if (safetyTimer !== undefined) clearTimeout(safetyTimer);
          if (focusTimer !== undefined) clearTimeout(focusTimer);
          cleanupListeners();
          // Remove only after the dialog has closed — early removal breaks Cancel.
          setTimeout(() => {
            try {
              iframe.remove();
            } catch {
              /* ignore */
            }
          }, 400);
          resolve(true);
        };

        // Cancel/Print both fire afterprint in Chromium/WebView2.
        win.onafterprint = () => finish();
        win.addEventListener("beforeprint", () => {
          dialogOpened = true;
        });

        // Fallback: after the dialog has opened, focus returning means it closed.
        // Do NOT finish on focus before beforeprint — that re-opens / stacks dialogs.
        function onWindowFocus(): void {
          if (!dialogOpened || settled) return;
          if (focusTimer !== undefined) clearTimeout(focusTimer);
          focusTimer = setTimeout(() => {
            if (dialogOpened && !settled) finish();
          }, 600);
        }
        window.addEventListener("focus", onWindowFocus);

        requestAnimationFrame(() => {
          try {
            win.focus();
            win.print();
            // Some WebViews never fire beforeprint — treat print() return as opened.
            setTimeout(() => {
              dialogOpened = true;
            }, 300);
          } catch {
            finish();
            return;
          }
          safetyTimer = setTimeout(finish, 180_000);
        });
      }),
  );
}

/** Opens the system print dialog (fire-and-forget). Prefer printHtmlDocumentAndWait. */
export function printHtmlDocument(html: string, docTitle?: string): boolean {
  void printHtmlDocumentAndWait(html, docTitle);
  return true;
}

export type PrintJobOptions = {
  /** Prefer sending to this OS printer when running inside Tauri. */
  systemPrinterName?: string;
  copies?: number;
  jobTitle?: string;
  /**
   * When an assigned OS printer is set:
   * - true (default): fail if native print fails (do not silently open the dialog)
   * - false: fall back to the OS print dialog
   */
  requireNamedPrinter?: boolean;
};

export type PrintJobResult = {
  ok: boolean;
  /** True when the job went to the named OS printer (no dialog). */
  usedNamedPrinter: boolean;
  error?: string;
};

/**
 * Print HTML: try named OS printer first (Tauri), otherwise open the print dialog.
 */
export async function printHtmlDocumentAsync(
  html: string,
  options?: PrintJobOptions,
): Promise<boolean> {
  const result = await printHtmlDocumentDetailed(html, options);
  return result.ok;
}

/** Same as printHtmlDocumentAsync but reports whether the named printer was used. */
export async function printHtmlDocumentDetailed(
  html: string,
  options?: PrintJobOptions,
): Promise<PrintJobResult> {
  const copies = Math.max(1, options?.copies ?? 1);
  const jobTitle = options?.jobTitle;
  const systemPrinterName = asPrinterName(options?.systemPrinterName);
  // Prefer silent Auto print; always allow dialog fallback so PDF/XPS/driver failures still print.
  const requireNamed = options?.requireNamedPrinter ?? false;

  if (systemPrinterName && !isVirtualSystemPrinter(systemPrinterName)) {
    const plain = htmlToPlainText(html);
    if (!plain) {
      return { ok: false, usedNamedPrinter: false, error: "Print content was empty after conversion." };
    }
    const result = await printToSystemPrinter({
      printerName: systemPrinterName,
      content: plain + "\n\n",
      jobName: jobTitle,
      copies,
      paperWidthMm: 80,
    });
    if (result.ok) return { ok: true, usedNamedPrinter: true };
    if (requireNamed) {
      return { ok: false, usedNamedPrinter: false, error: result.error };
    }
  }

  // OS print dialog already has its own Copies control — open it once only.
  // Looping here stacked 2–3 identical receipt dialogs on Pay.
  const opened = await printHtmlDocumentAndWait(html, jobTitle);
  if (!opened) {
    return { ok: false, usedNamedPrinter: false, error: "Could not open the print dialog." };
  }
  return { ok: true, usedNamedPrinter: false };
}

/** Opens the system print dialog with a thermal-style ticket (sync / dialog fallback). */
export function printTicket(input: PrintTicketInput): boolean {
  void printTicketDetailed(input);
  return true;
}

/** Print a ticket, routing to the assigned OS printer when `systemPrinterName` is set. */
export async function printTicketAsync(input: PrintTicketInput): Promise<boolean> {
  const result = await printTicketDetailed(input);
  return result.ok;
}

/** Monospace HTML wrapper for the Windows print dialog — same layout as Auto plain text (no stretch). */
export function buildThermalDialogHtml(
  plain: string,
  paperSize: PrinterPaperSize,
  marginMm = 2,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): string {
  const pageW = paperWidthMm(paperSize, customPaperWidthMm);
  const side = Math.max(0, Math.min(1, marginMm));
  const fontPx = isNarrowPaperWidth(paperSize, customPaperWidthMm) ? 12 : 13;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>POPS Print</title>
  <style>
    @page {
      size: ${pageW}mm auto;
      margin: 1mm ${side}mm 2mm ${side}mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      background: #fff;
      color: #000;
    }
    pre {
      margin: 0;
      padding: 2px 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-family: Consolas, "Courier New", monospace;
      font-size: ${fontPx}px;
      font-weight: 700;
      line-height: 1.2;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: hidden;
      color: #000;
      -webkit-font-smoothing: none;
    }
    @media print {
      html, body { width: ${pageW}mm !important; max-width: ${pageW}mm !important; }
      pre { white-space: pre-wrap; }
    }
  </style>
</head>
<body><pre>${escapeHtml(plain)}</pre></body>
</html>`;
}

/**
 * One design everywhere (preview + print): styled ticket HTML (receipt / KOT).
 */
export function buildPrintPreviewHtml(input: PrintTicketInput): string {
  return buildTicketHtml(input);
}

/** Force pure black/white — grey anti-alias dither looks broken on thermal. */
async function binarizePngBytes(png: Uint8Array, threshold = 168): Promise<Uint8Array | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return png;
  try {
    const blob = new Blob([png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength)], {
      type: "image/png",
    });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return png;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = y < threshold ? 0 : 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const outBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!outBlob) return png;
    return new Uint8Array(await outBlob.arrayBuffer());
  } catch {
    return png;
  }
}

/** Rasterize styled ticket HTML so Auto/named printers print the exact preview design. */
export async function renderTicketHtmlToPngBytes(
  html: string,
  paper: PrinterPaperSize,
  customPaperWidthMm = DEFAULT_THERMAL_PRINT_SETTINGS.customPaperWidthMm,
): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null;
  const widthPx = receiptRenderWidthPx(paper, customPaperWidthMm);
  // 2× is sharp enough on 203 DPI and avoids oversized soft bitmaps.
  const pixelRatio = 2;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${widthPx}px;height:auto;overflow:hidden;background:#fff;pointer-events:none;opacity:0;z-index:-1;`;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.setAttribute("scrolling", "no");
  iframe.style.cssText = `display:block;width:${widthPx}px;border:0;background:#fff;overflow:hidden;`;
  host.appendChild(iframe);
  document.body.appendChild(host);
  try {
    const idoc = iframe.contentDocument;
    if (!idoc) return null;
    idoc.open();
    idoc.write(html);
    idoc.close();
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const t = window.setTimeout(done, 1200);
      iframe.onload = () => {
        window.clearTimeout(t);
        requestAnimationFrame(() => requestAnimationFrame(done));
      };
    });
    try {
      await idoc.fonts?.ready;
    } catch {
      /* ignore */
    }
    // Wait for remote/local images (PRA QR) so silent PNG matches the intended slip.
    try {
      const imgs = Array.from(idoc.images ?? []);
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete && img.naturalWidth > 0) {
                  resolve();
                  return;
                }
                const finish = () => resolve();
                img.addEventListener("load", finish, { once: true });
                img.addEventListener("error", finish, { once: true });
              }),
          ),
        ),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 80));
    const body = idoc.body;
    if (!body) return null;

    // Kill UI scrollbars so they never appear on the thermal slip.
    const hideScroll = idoc.createElement("style");
    hideScroll.textContent = `
      html, body { overflow: hidden !important; margin: 0 !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
    `;
    idoc.head?.appendChild(hideScroll);

    const htmlEl = idoc.documentElement;
    htmlEl.style.width = `${widthPx}px`;
    htmlEl.style.maxWidth = `${widthPx}px`;
    htmlEl.style.margin = "0";
    htmlEl.style.padding = "0";
    htmlEl.style.overflow = "hidden";
    body.style.width = `${widthPx}px`;
    body.style.maxWidth = `${widthPx}px`;
    body.style.boxSizing = "border-box";
    body.style.margin = "0";
    body.style.overflow = "hidden";
    body.style.background = "#fff";
    body.style.color = "#000";
    body.style.setProperty("-webkit-font-smoothing", "none");
    body.style.setProperty("font-smooth", "never");
    // White tail so the thermal cutter clears "Net Total" / footer (not mid-line).
    const cutClearPx = Math.max(36, Math.round(widthPx * 0.12));
    body.style.paddingBottom = `${cutClearPx}px`;

    const height = Math.ceil(
      Math.max(
        body.scrollHeight,
        body.offsetHeight,
        htmlEl.scrollHeight,
        80,
      ),
    );
    // Trim trailing blank canvas — scrollHeight can include collapsed-margin ghosts.
    iframe.style.height = `${height}px`;
    iframe.style.overflow = "hidden";
    body.style.height = "auto";
    body.style.minHeight = "0";

    const measured = Math.ceil(
      Math.max(body.scrollHeight, body.getBoundingClientRect().height, 80),
    );
    iframe.style.height = `${measured}px`;

    const dataUrl = await toPng(body, {
      width: widthPx,
      height: measured,
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      style: {
        width: `${widthPx}px`,
        maxWidth: `${widthPx}px`,
        height: "auto",
        margin: "0",
        overflow: "hidden",
        background: "#ffffff",
        color: "#000000",
        boxSizing: "border-box",
      },
    });
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return (await binarizePngBytes(bytes)) ?? bytes;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

/** Short staff label from a session `sub` (email local-part or id). Prefer resolveSessionPrintName. */
export function formatSessionPrintName(sub: string | undefined | null): string {
  return resolveSessionPrintName(sub);
}

const ORG_USERS_PRINT_CACHE_KEY = "pops-org-users-print-cache-v1";

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/** `ali.khan@x.com` → `Ali Khan` */
export function prettyNameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? email).trim();
  if (!local) return "";
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Cache org users so print can show email-based names instead of UUID `sub`. */
export function cacheOrgUsersForPrint(users: Array<{ id: string; email: string }>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const map: Record<string, string> = {};
    for (const u of users) {
      const id = u.id?.trim();
      const email = u.email?.trim();
      if (!id || !email) continue;
      map[id] = prettyNameFromEmail(email);
    }
    localStorage.setItem(ORG_USERS_PRINT_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function lookupCachedPrintName(userId: string): string {
  if (typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(ORG_USERS_PRINT_CACHE_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    return (map[userId] ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Human name for receipts/KOTs — never print a raw user UUID.
 * Resolves JWT `sub` (user id) via org-user email cache, or email local-part.
 */
export function resolveSessionPrintName(userIdOrEmail: string | undefined | null): string {
  const raw = (userIdOrEmail ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return prettyNameFromEmail(raw);
  const cached = lookupCachedPrintName(raw);
  if (cached) return cached;
  // UUID without a resolved name — do not print the id on the slip.
  if (isUuidLike(raw)) return "";
  return raw;
}

/** Who printed this slip — ticket staff name, else current logged-in user. */
function staffNameForReceipt(input: PrintTicketInput): string {
  const fromTicket = resolveSessionPrintName(input.waiterName);
  if (fromTicket && !/^pos\s*counter$/i.test(fromTicket)) return fromTicket;
  try {
    const fromSession = resolveSessionPrintName(useSessionStore.getState().claims?.sub);
    if (fromSession) return fromSession;
  } catch {
    // ignore (non-browser)
  }
  return fromTicket || "";
}

/** Print a ticket and report whether the named OS printer was used. */
export async function printTicketDetailed(input: PrintTicketInput): Promise<PrintJobResult> {
  if (input.lines.length === 0) {
    return { ok: false, usedNamedPrinter: false, error: "No lines to print." };
  }

  const { trackPrintJob } = await import("./printQueueMonitor");
  const kind: import("./printHistory").PrintKind =
    input.historyKind ??
    (input.branchCode.trim().toUpperCase() === "TEST"
      ? "test"
      : input.praFiscal
        ? "pra"
        : input.kind === "receipt"
          ? "receipt"
          : "kot");
  const tracker = trackPrintJob({
    branchCode: input.branchCode,
    kind,
    orderRef: input.orderRef ?? input.billRef,
    printerName: input.systemPrinterName ?? input.printerName,
    source: "pc",
    deviceLabel: "desktop-launcher",
  });

  try {
    const result = await printTicketDetailedCore(input);
    tracker.finish(result.ok, result.error);
    return result;
  } catch (err) {
    tracker.finish(false, err instanceof Error ? err.message : "Print failed");
    throw err;
  }
}

async function printTicketDetailedCore(input: PrintTicketInput): Promise<PrintJobResult> {
  const docTitle = input.printerName
    ? `${input.kind === "receipt" ? "Receipt" : "KOT"} · ${input.printerName}`
    : input.kind === "receipt"
      ? "Receipt"
      : "KOT";
  const systemPrinterName = asPrinterName(input.systemPrinterName);
  const copies = Math.max(1, input.copies ?? 1);
  const thermal = resolveThermalSettings(input);
  const paper = resolvePaperSize(input, thermal);
  // Same styled HTML for preview, Auto print, and dialog — never a different slip.
  const styledHtml = buildTicketHtml(input);
  const paperMm = paperWidthMm(paper, thermal.customPaperWidthMm);

  // Option 19: Accountant / Owner / non-POS PCs must not steal the thermal spooler.
  // Virtual PDF targets and browser dialogs stay allowed for Export-style workflows.
  try {
    const { canDirectThermalPrint, directThermalPrintBlockedMessage } = await import(
      "./canDirectThermalPrint"
    );
    const { useSessionStore } = await import("../../stores/sessionStore");
    const { usePopsStore } = await import("../../stores/popsStore");
    const claims = useSessionStore.getState().claims;
    const displayRole = usePopsStore.getState().displayRole;
    const wantsPhysical =
      Boolean(systemPrinterName) &&
      !isVirtualSystemPrinter(systemPrinterName) &&
      isDesktopAppRuntime();
    if (wantsPhysical && !canDirectThermalPrint(claims, displayRole)) {
      return {
        ok: false,
        usedNamedPrinter: false,
        error: directThermalPrintBlockedMessage(),
      };
    }
  } catch {
    // If gate fails to load, continue (do not brick POS printing).
  }

  // POS / bill Print always goes to the Windows spooler below.
  // Enterprise queue is for mobile→PC workers (cloud poller), not for local Print clicks —
  // enqueue-then-ok previously toasted success while the thermal stayed silent.

  if (systemPrinterName) {
    // Browser / non-Tauri: Windows spooler is unavailable — always open the print dialog
    // (Simple invoice + Close/Pay Real PRA both use this path).
    if (!isDesktopAppRuntime()) {
      const opened = await printHtmlDocumentAndWait(styledHtml, docTitle);
      if (!opened) {
        return {
          ok: false,
          usedNamedPrinter: false,
          error: "Could not open the print dialog. Hard-refresh and try Print again.",
        };
      }
      return { ok: true, usedNamedPrinter: false };
    }

    // Never open XPS/OpenXPS Save As — remap to Microsoft Print to PDF.
    const targetPrinter = preferPdfOverXpsPrinter(systemPrinterName) ?? systemPrinterName;

    // PDF (or other virtual file target) — print image to PDF writer (Save As *.pdf).
    if (isVirtualSystemPrinter(targetPrinter)) {
      if (isXpsSystemPrinter(systemPrinterName) || /print\s*to\s*pdf/i.test(targetPrinter)) {
        const png = await renderTicketHtmlToPngBytes(styledHtml, paper, thermal.customPaperWidthMm);
        if (png?.length) {
          const imgResult = await printImageToSystemPrinter({
            printerName: "Microsoft Print to PDF",
            pngBytes: png,
            jobName: docTitle,
            copies,
            paperWidthMm: paperMm,
          });
          if (imgResult.ok) return { ok: true, usedNamedPrinter: true };
        }
      }
      const opened = await printHtmlDocumentAndWait(styledHtml, docTitle);
      if (!opened) {
        return { ok: false, usedNamedPrinter: false, error: "Could not open the print dialog." };
      }
      return { ok: true, usedNamedPrinter: false };
    }

    const png = await renderTicketHtmlToPngBytes(styledHtml, paper, thermal.customPaperWidthMm);
    if (!png?.length) {
      // Raster failed — still offer the dialog so Close/Print is not a dead end.
      const opened = await printHtmlDocumentAndWait(styledHtml, docTitle);
      if (!opened) {
        return {
          ok: false,
          usedNamedPrinter: false,
          error: "Could not render receipt image for the printer.",
        };
      }
      return { ok: true, usedNamedPrinter: false };
    }
    const imgResult = await printImageToSystemPrinter({
      printerName: targetPrinter,
      pngBytes: png,
      jobName: docTitle,
      copies,
      paperWidthMm: paperMm,
    });
    try {
      const { announcePrintJobDone } = await import("./branchPrintClient");
      announcePrintJobDone({
        ok: imgResult.ok,
        orderId: input.orderRef ?? null,
        printerName: targetPrinter,
        error: imgResult.error ?? null,
        source: "direct",
        kind: input.kind,
      });
    } catch {
      // ignore
    }
    if (imgResult.ok) return { ok: true, usedNamedPrinter: true };

    // Browser / Tauri bridge unavailable — open OS dialog so Print still works (PDF or physical).
    if (imgResult.unsupported) {
      const opened = await printHtmlDocumentAndWait(styledHtml, docTitle);
      if (!opened) {
        return {
          ok: false,
          usedNamedPrinter: false,
          error: imgResult.error ?? "Could not open the print dialog.",
        };
      }
      return { ok: true, usedNamedPrinter: false };
    }

    // Physical Auto printer failed — do NOT open Windows dialog (that defaults to PDF).
    // Surface the error so staff can fix USB / offline / wrong assignment.
    return {
      ok: false,
      usedNamedPrinter: false,
      error:
        imgResult.error ??
        `Printer "${targetPrinter}" failed. Check USB/power, or re-link in Printer → Use for section.`,
    };
  }

  // No linked OS printer — only then open the Windows dialog (user may pick PDF there).
  const opened = await printHtmlDocumentAndWait(styledHtml, docTitle);
  if (!opened) {
    return { ok: false, usedNamedPrinter: false, error: "Could not open the print dialog." };
  }
  return { ok: true, usedNamedPrinter: false };
}

/** Test page — prints a sample tax invoice using the same layout as live bills. */
export function printTestPage(printerName: string): boolean {
  void printTestPageAsync(printerName);
  return true;
}

export async function printTestPageAsync(
  printerName: string,
  options?: {
    copies?: number;
    branchCode?: string;
    paperSize?: PrinterPaperSize;
    thermal?: ThermalPrintSettings;
    /** Stamp paper settings on the slip for physical verification. */
    completeTestLabel?: boolean;
  },
): Promise<boolean> {
  const branchCode = options?.branchCode?.trim() || "TEST";
  const thermal =
    options?.thermal ??
    (options?.branchCode
      ? loadThermalPrintSettings(options.branchCode)
      : DEFAULT_THERMAL_PRINT_SETTINGS);
  const paper = options?.paperSize ?? thermal.defaultPaperSize;
  const billSettings =
    resolveBillPrintSettingsForReceipt(branchCode) ?? loadBillPrintSettings(branchCode);
  const sample = sampleBillPrintInput("BuchaSoft", branchCode);
  const copies = Math.max(1, options?.copies ?? 1);
  const rollMm = paperWidthMm(paper, thermal.customPaperWidthMm);
  const notes =
    options?.completeTestLabel === true
      ? `TEST · ${paper === "custom" ? `${rollMm}mm custom` : paper} · margin ${thermal.marginMm} · ${
          thermal.receiptLayout === "clear" ? "Stacked" : thermal.showUnitPrice ? "Columns+Price" : "Columns"
        }`
      : sample.notes;

  const result = await printTicketDetailed({
    ...sample,
    notes,
    kind: "receipt",
    historyKind: "test",
    paperSize: paper,
    thermal,
    copies,
    printerName: printerName.trim() || "Test printer",
    systemPrinterName: printerName.trim() || undefined,
    billPrintSettings: {
      ...billSettings,
      documentTitle: billSettings.documentTitle || "Receipt",
      footerText: billSettings.footerText || "Thank you — visit again",
      fields: {
        ...billSettings.fields,
        notes: options?.completeTestLabel ? true : billSettings.fields.notes,
      },
    },
  });
  return result.ok;
}

export function billToPrintInput(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Omit<PrintTicketInput, "kind"> {
  const contact = parseDeliveryFieldsFromNotes(bill.notes);
  const cashReceived = parseCashReceivedFromNotes(bill.notes);
  return {
    branchName,
    branchCode,
    orderRef: bill.orderRef ?? bill.billRef,
    billRef: bill.billRef,
    // Never print raw user UUIDs — resolve to email-based display name.
    waiterName: resolveSessionPrintName(bill.waiterName) || undefined,
    notes: bill.notes ?? undefined,
    customerName: contact.customer || undefined,
    customerPhone: contact.phone || undefined,
    customerAddress: contact.address || undefined,
    riderName: bill.riderName?.trim() || contact.riderName || undefined,
    modeLabel: billChannelLabel(bill.tableLabel),
    tableLabel: bill.tableLabel,
    lines: bill.lines.map((line) => ({
      label: line.label,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    subtotal: bill.subtotal,
    discount: bill.discount,
    service: bill.service,
    tax: bill.tax,
    deliveryCharge: bill.deliveryChargePkr > 0 ? bill.deliveryChargePkr : undefined,
    total: bill.total,
    servicePct: bill.servicePct,
    taxPct: bill.taxPct,
    discountPct: bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0,
    payments: bill.payments?.length ? bill.payments : undefined,
    cashReceived: cashReceived > bill.total ? cashReceived : undefined,
  };
}

export function printReceipt(input: Omit<PrintTicketInput, "kind">): boolean {
  return printTicket({ ...input, kind: "receipt" });
}

export async function printReceiptAsync(input: Omit<PrintTicketInput, "kind">): Promise<boolean> {
  return printTicketAsync({ ...input, kind: "receipt" });
}

export async function printReceiptDetailed(
  input: Omit<PrintTicketInput, "kind">,
): Promise<PrintJobResult> {
  return printTicketDetailed({ ...input, kind: "receipt" });
}

export function printBill(
  branchName: string,
  branchCode: string,
  bill: Bill,
  options?: {
    printerName?: string;
    systemPrinterName?: string;
    billPrintSettings?: BillPrintSettings;
    paperSize?: PrinterPaperSize;
    copies?: number;
  },
): boolean {
  void printBillAsync(branchName, branchCode, bill, options);
  return true;
}

export async function printBillAsync(
  branchName: string,
  branchCode: string,
  bill: Bill,
  options?: {
    printerName?: string;
    systemPrinterName?: string;
    billPrintSettings?: BillPrintSettings;
    paperSize?: PrinterPaperSize;
    copies?: number;
  },
): Promise<boolean> {
  // Never treat display/profile names as OS spooler names.
  const systemPrinterName = asPrinterName(options?.systemPrinterName);
  return printReceiptAsync({
    ...billToPrintInput(branchName, branchCode, bill),
    printerName: options?.printerName ?? systemPrinterName,
    systemPrinterName,
    paperSize: options?.paperSize,
    copies: options?.copies,
    billPrintSettings:
      options?.billPrintSettings ??
      resolveBillPrintSettingsForReceipt(branchCode) ??
      loadBillPrintSettings(branchCode),
  });
}

export function kitchenTicketToKotPrint(
  ticket: KitchenTicket,
  branchName: string,
  branchCode: string,
  options?: { printedByName?: string; isOrderUpdate?: boolean },
): Omit<PrintTicketInput, "kind"> {
  // Prefer structured lines so Update / reprint KOT always includes latest item changes.
  const fromTicketLines =
    ticket.lines && ticket.lines.length > 0
      ? ticket.lines.map((line) => ({
          label: line.label,
          qty: line.qty,
          unitPrice: 0,
        }))
      : [];
  const fromSummary = parseItemsSummary(ticket.itemsSummary).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: 0,
  }));
  const lines = fromTicketLines.length > 0 ? fromTicketLines : fromSummary;
  const by = resolveSessionPrintName(
    options?.printedByName?.trim() || ticket.createdByName?.trim() || undefined,
  );
  const ticketNotes = resolveTicketDeliveryNotes(ticket) ?? ticket.notes ?? undefined;
  const contact = parseDeliveryFieldsFromNotes(ticketNotes);

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: billChannelLabel(ticket.stationLabel),
    tableLabel: ticket.stationLabel,
    waiterName: by || undefined,
    notes: ticketNotes,
    customerName: contact.customer || undefined,
    customerPhone: contact.phone || undefined,
    customerAddress: contact.address || undefined,
    riderName: ticket.riderName?.trim() || contact.riderName || undefined,
    lines: lines.length > 0 ? lines : [{ label: ticket.itemsSummary || "Items", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
    isOrderUpdate: options?.isOrderUpdate,
  };
}

/** Customer/order receipt from a Latest-orders card (never a kitchen KOT). */
export function posRecentOrderToReceiptPrint(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
): Omit<PrintTicketInput, "kind"> {
  if (order.kind === "paid" && order.bill) {
    return billToPrintInput(branchName, branchCode, order.bill);
  }

  const settings = loadPosSettings(branchCode);
  const mode = inferPosModeFromLabel(order.stationLabel ?? order.orderMode ?? "");
  const taxPct = effectiveTaxPctForMode(settings, mode);
  const rawLines =
    order.detail.kind === "pending"
      ? order.detail.lines
      : order.detail.lines.map((line) => ({
          label: line.label,
          qty: line.qty,
          unitPrice: line.unitPrice,
        }));
  const lines = rawLines.map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice ?? 0,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const deliveryCharge = order.kitchenTicket?.deliveryChargePkr ?? 0;
  const notes =
    order.bill?.notes ??
    resolveTicketDeliveryNotes(order.kitchenTicket ?? {}) ??
    order.kitchenTicket?.notes ??
    undefined;
  const discountFromNotes = discountAmountFromTicketNotes(notes, subtotal);
  const servicePct = effectiveServicePctForMode(settings, mode);
  const totals = computeTicketTotals(
    subtotal,
    discountFromNotes,
    servicePct,
    taxPct,
    deliveryCharge,
  );

  const contact = parseDeliveryFieldsFromNotes(notes);

  return {
    branchName,
    branchCode,
    orderRef: order.ref,
    modeLabel: order.orderMode,
    tableLabel: order.stationLabel,
    waiterName:
      resolveSessionPrintName(order.bill?.waiterName) ||
      resolveSessionPrintName(order.kitchenTicket?.createdByName) ||
      undefined,
    notes,
    customerName: contact.customer || undefined,
    customerPhone: contact.phone || undefined,
    customerAddress: contact.address || undefined,
    riderName:
      order.bill?.riderName?.trim() ||
      order.kitchenTicket?.riderName?.trim() ||
      contact.riderName ||
      undefined,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    service: totals.service,
    tax: totals.tax,
    deliveryCharge: totals.deliveryCharge > 0 ? totals.deliveryCharge : undefined,
    total: totals.total,
    servicePct,
    taxPct,
    discountPct: totals.discountPct,
  };
}

export function printPosRecentOrder(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string; systemPrinterName?: string },
): boolean {
  void printPosRecentOrderAsync(branchName, branchCode, order, options);
  return true;
}

/** Latest-orders Close / paid reprint: customer receipt (not kitchen KOT). */
export async function printPosRecentOrderAsync(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string; systemPrinterName?: string },
): Promise<boolean> {
  const systemPrinterName = asPrinterName(options?.systemPrinterName);
  return printReceiptAsync({
    ...posRecentOrderToReceiptPrint(branchName, branchCode, order),
    printerName: options?.printerName ?? systemPrinterName,
    systemPrinterName,
    billPrintSettings:
      resolveBillPrintSettingsForReceipt(branchCode) ?? loadBillPrintSettings(branchCode),
  });
}

export function printKot(input: Omit<PrintTicketInput, "kind">): boolean {
  return printTicket({ ...input, kind: "kot" });
}

export async function printKotAsync(input: Omit<PrintTicketInput, "kind">): Promise<boolean> {
  return printTicketAsync({ ...input, kind: "kot" });
}

export async function printKotDetailed(
  input: Omit<PrintTicketInput, "kind">,
): Promise<PrintJobResult> {
  return printTicketDetailed({ ...input, kind: "kot" });
}
