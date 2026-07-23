import type { Bill, KitchenTicket } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { computeTicketTotals } from "./posDiscount";
import { loadPosSettings } from "./posSettings";
import { parseItemsSummary, type PosRecentOrder } from "./recentOrders";
import {
  billReceiptFontSizes,
  getBlockStyle,
  isBillSystemBlock,
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  resolveBlockFontSize,
  type BillPrintSettings,
} from "./billPrintSettings";
import { resolveBillPrintSettingsForReceipt } from "./billReceiptTemplateAssignments";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  type KotPrintSettings,
} from "./kotPrintSettings";
import type { PrinterPaperSize, PrinterProfile } from "./printerRouting";
import { isVirtualSystemPrinter, printToSystemPrinter } from "./systemPrinters";
import {
  DEFAULT_THERMAL_PRINT_SETTINGS,
  loadThermalPrintSettings,
  thermalCharsPerLine,
  thermalContentWidthMm,
  type ThermalPrintSettings,
} from "./thermalPrintSettings";

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
  notes?: string;
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
  kotSettings?: KotPrintSettings;
  billPrintSettings?: BillPrintSettings;
  /**
   * When true (edited kitchen ticket), KOT shows a clear UPDATE marker
   * so kitchen staff can tell it apart from a new order.
   */
  isOrderUpdate?: boolean;
};

/** Apply a resolved printer profile onto a ticket payload. */
export function withPrinterProfile<T extends Omit<PrintTicketInput, "kind">>(
  input: T,
  profile: PrinterProfile | null | undefined,
): T {
  if (!profile) return input;
  const linked = profile.systemPrinterName?.trim();
  const fromProfile = linked && !isVirtualSystemPrinter(linked) ? linked : undefined;
  const fromInput =
    input.systemPrinterName?.trim() && !isVirtualSystemPrinter(input.systemPrinterName)
      ? input.systemPrinterName.trim()
      : undefined;
  return {
    ...input,
    printerName: profile.name,
    systemPrinterName: fromProfile ?? fromInput,
    copies: profile.copies,
    paperSize: profile.paperSize,
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
  const cls = line.bold ? "custom-line custom-line-bold" : "custom-line";
  return `<div class="${cls}" style="text-align:${align};font-size:${size}px;font-weight:${weight}">${escapeHtml(line.text.trim())}</div>`;
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
  return `font-size:${size}px;font-weight:${bold ? 600 : 400}`;
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

function resolvePaperSize(
  input: Pick<PrintTicketInput, "paperSize" | "branchCode">,
  thermal: ThermalPrintSettings,
): PrinterPaperSize {
  return input.paperSize ?? thermal.defaultPaperSize;
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

/**
 * Fixed-width plain text for physical thermal printers (named OS spooler path).
 * "clear" layout stacks item + amount so nothing clips on 58mm paper.
 */
export function buildThermalPlainText(
  input: PrintTicketInput,
  thermalOverride?: ThermalPrintSettings,
): string {
  const thermal =
    thermalOverride ??
    (input.branchCode
      ? loadThermalPrintSettings(input.branchCode)
      : DEFAULT_THERMAL_PRINT_SETTINGS);
  const paper = resolvePaperSize(input, thermal);
  const width = thermalCharsPerLine(paper, thermal);
  const compact = thermal.compactMoney;
  activeShowCurrencyPrefix = thermal.showCurrencyPrefix === true;
  const isReceipt = input.kind === "receipt";
  const billSettings =
    input.billPrintSettings ??
    (input.branchCode
      ? resolveBillPrintSettingsForReceipt(input.branchCode)
      : DEFAULT_BILL_PRINT_SETTINGS);
  const fields = isReceipt ? billSettings.fields : null;
  const useClearLayout = isReceipt && thermal.receiptLayout === "clear";
  const showPrice =
    isReceipt &&
    !useClearLayout &&
    Boolean(fields?.itemAmount) &&
    thermal.showUnitPrice;
  const showAmt = isReceipt && Boolean(fields?.itemAmount);
  const dash = "-".repeat(width);
  const equals = "=".repeat(width);
  const out: string[] = [];

  const pushBlank = () => out.push("");

  const business =
    isReceipt && billSettings.headerBusinessName.trim()
      ? billSettings.headerBusinessName.trim()
      : input.branchName;
  if (!isReceipt || fields?.branchName !== false) {
    for (const w of wrapWords(business, width)) out.push(centerLine(w, width));
  }
  if (isReceipt && fields?.headerSubtitle && billSettings.headerSubtitle.trim()) {
    for (const w of wrapWords(billSettings.headerSubtitle.trim(), width)) {
      out.push(centerLine(w, width));
    }
  }
  const title = isReceipt
    ? billSettings.documentTitle
    : input.isOrderUpdate
      ? "KITCHEN ORDER - UPDATE"
      : "KITCHEN ORDER";
  if (!isReceipt || fields?.documentTitle !== false) {
    out.push(centerLine(title.toUpperCase(), width));
  }
  out.push(equals);

  const pushWrapped = (text: string) => {
    for (const w of wrapWords(text, width)) out.push(w);
  };
  const pushKv = (label: string, value: string) => {
    const left = label.trim();
    const right = value.trim();
    if (!left && !right) return;
    if (left.length + right.length + 1 <= width) {
      out.push(padRight(left, width - right.length) + right);
      return;
    }
    pushWrapped(left);
    for (const w of wrapWords(right, width)) {
      out.push(padLeft(w, width));
    }
  };
  if (!isReceipt || fields?.orderRef !== false) {
    pushWrapped(input.orderRef);
  }
  if (!isReceipt || fields?.orderType !== false) {
    pushWrapped(input.modeLabel);
  }
  if (input.tableLabel && (!isReceipt || fields?.tableLabel !== false)) {
    pushWrapped(input.tableLabel);
  }
  if (input.billRef && (!isReceipt || fields?.billRef !== false)) {
    pushKv("Bill", input.billRef);
  }
  if (input.waiterName && (!isReceipt || fields?.waiterName !== false)) {
    pushKv("Waiter", input.waiterName);
  }
  const printedAt = new Date().toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (!isReceipt || fields?.timestamp !== false) {
    pushKv("Time", printedAt);
  }
  if (input.notes && (!isReceipt || fields?.notes !== false)) {
    pushBlank();
    for (const w of wrapWords(`Note: ${input.notes}`, width)) out.push(w);
  }
  const plainAlign =
    isReceipt && billSettings.headerAlign === "left" ? ("left" as const) : ("center" as const);
  const pushCustomsBetween = (afterId: string, beforeId: string) => {
    if (!isReceipt) return;
    const order = billSettings.blockOrder;
    const a = order.indexOf(afterId);
    const b = order.indexOf(beforeId);
    if (a < 0 || b < 0 || b <= a) return;
    for (const id of order.slice(a + 1, b)) {
      if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
    }
  };
  pushCustomsBetween("documentTitle", "meta");
  pushCustomsBetween("meta", "notes");
  pushCustomsBetween("notes", "timestamp");
  pushCustomsBetween("timestamp", "items");
  out.push(dash);

  if (isReceipt && showAmt && useClearLayout) {
    // Clear stacked layout: each item is fully readable on narrow paper.
    for (const row of input.lines) {
      const lineTotal = formatMoney(row.unitPrice * row.qty, compact);
      const unit = formatMoney(row.unitPrice, compact);
      const head = `${row.qty} x ${row.label}`;
      for (const w of wrapWords(head, width)) out.push(w);
      if (row.qty > 1) {
        out.push(padLeft(`@ ${unit}`, width));
      }
      out.push(padLeft(lineTotal, width));
      pushBlank();
    }
    if (out[out.length - 1] === "") out.pop();
  } else if (isReceipt && showAmt) {
    // Prefer no unit-price on very narrow rolls so AMOUNT never clips.
    const wantPrice = showPrice && width >= 36;
    const amountSamples = input.lines.map((row) => formatMoney(row.unitPrice * row.qty, compact));
    const cols = receiptPlainColumns(width, wantPrice, amountSamples);
    if (fields?.itemHeaders !== false) {
      out.push(
        plainReceiptItemRow(
          "QTY",
          "ITEM",
          cols.showPrice ? "AMT" : "AMT",
          cols,
          cols.showPrice ? "PRICE" : "",
        ),
      );
      out.push(dash);
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
    const qtyW = 4;
    const itemW = Math.max(6, width - qtyW - 1);
    out.push(`${padRight("Qty", qtyW)} ${padRight("Item", itemW)}`);
    out.push(dash);
    for (const row of input.lines) {
      const nameLines = wrapWords(row.label, itemW);
      nameLines.forEach((name, idx) => {
        out.push(
          `${padRight(idx === 0 ? String(row.qty) : "", qtyW)} ${padRight(name, itemW)}`,
        );
      });
    }
  }

  if (isReceipt) {
    const order = billSettings.blockOrder;
    const a = order.indexOf("items");
    const b = order.indexOf("totals");
    if (a >= 0 && b > a) {
      for (const id of order.slice(a + 1, b)) {
        if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
      }
    }
  }

  if (isReceipt && fields) {
    out.push(dash);
    const pushTotal = (label: string, value: string) => {
      out.push(plainLabelValueLine(label, value, width));
    };
    if (fields.subtotal) pushTotal("Subtotal", formatMoney(input.subtotal, compact));
    if (fields.discount && input.discount > 0) {
      pushTotal(
        `Discount${input.discountPct > 0 ? ` ${input.discountPct}%` : ""}`,
        `-${formatMoney(input.discount, compact)}`,
      );
    }
    if (fields.service) {
      pushTotal(`Service ${input.servicePct}%`, formatMoney(input.service, compact));
    }
    if (fields.tax) {
      pushTotal(`Tax ${input.taxPct ?? 15}%`, formatMoney(input.tax, compact));
    }
    if (fields.delivery && (input.deliveryCharge ?? 0) > 0) {
      pushTotal("Delivery", formatMoney(input.deliveryCharge!, compact));
    }
    if (fields.total) {
      out.push(equals);
      pushTotal("TOTAL", formatMoney(input.total, compact));
      out.push(equals);
    }
  } else if (!isReceipt) {
    const kotSettings =
      input.kotSettings ??
      (input.branchCode ? loadKotPrintSettings(input.branchCode) : DEFAULT_KOT_PRINT_SETTINGS);
    if (kotSettings.showItemTotals) {
      out.push(dash);
      out.push(
        `Items: ${input.lines.length}   Qty: ${input.lines.reduce((s, l) => s + l.qty, 0)}`.slice(
          0,
          width,
        ),
      );
    }
  }

  if (isReceipt && fields?.footer !== false) {
    pushBlank();
    for (const w of wrapWords(billSettings.footerText || "THANK YOU --- VISIT AGAIN", width)) {
      out.push(centerLine(w.toUpperCase(), width));
    }
    if (fields?.footerSecondary && billSettings.footerSecondaryText.trim()) {
      for (const w of wrapWords(billSettings.footerSecondaryText.trim(), width)) {
        out.push(centerLine(w, width));
      }
    }
  }
  if (isReceipt) {
    const order = billSettings.blockOrder;
    const a = Math.max(order.indexOf("footer"), order.indexOf("footerSecondary"));
    for (const id of order.slice(a + 1)) {
      if (!isBillSystemBlock(id)) pushCustomLinePlain(out, billSettings, id, width, plainAlign);
    }
  } else if (!isReceipt) {
    pushBlank();
    out.push(centerLine(input.isOrderUpdate ? "KITCHEN COPY - UPDATE" : "KITCHEN COPY", width));
  }
  out.push("");
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
  const thermal =
    input.branchCode
      ? loadThermalPrintSettings(input.branchCode)
      : DEFAULT_THERMAL_PRINT_SETTINGS;
  const paperSize = resolvePaperSize(input, thermal);
  const narrowPaper = paperSize === "58mm";
  const marginMm = thermal.marginMm;
  const contentWidthMm = thermalContentWidthMm(paperSize, marginMm);
  const moneyCompact = thermal.compactMoney;
  activeShowCurrencyPrefix = thermal.showCurrencyPrefix === true;
  const receiptFonts = billReceiptFontSizes(billSettings.baseFontSize);
  const fields = isReceipt ? billSettings.fields : null;
  const isOrderUpdate = !isReceipt && Boolean(input.isOrderUpdate);
  const title = isReceipt
    ? billSettings.documentTitle
    : isOrderUpdate
      ? "Kitchen Order — UPDATE"
      : "Kitchen Order";
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalItems = input.lines.length;
  const totalQty = input.lines.reduce((sum, line) => sum + line.qty, 0);

  // Pay / invoice receipt: columns (QTY | ITEM | PRICE | AMOUNT) unless user chose Clear.
  // On 58mm, drop unit PRICE so AMOUNT fits the printable width.
  const useClearLayout = isReceipt && thermal.receiptLayout === "clear";
  const showAmtColEarly = isReceipt && Boolean(fields?.itemAmount);
  const showPriceCol =
    showAmtColEarly &&
    !useClearLayout &&
    !narrowPaper &&
    (thermal.showUnitPrice || thermal.receiptLayout === "columns");

  const clearItemBlocks =
    useClearLayout && showAmtColEarly
      ? input.lines
          .map((line) => {
            const lineTotal = line.unitPrice * line.qty;
            return `<div class="clear-item">
        <div class="clear-item-name">${escapeHtml(`${line.qty} x ${line.label}`)}</div>
        ${
          line.qty > 1
            ? `<div class="clear-item-unit">@ ${formatMoney(line.unitPrice, moneyCompact)}</div>`
            : ""
        }
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
        <td class="qty">${line.qty}</td>
        <td class="item-name">${escapeHtml(line.label)}</td>
      </tr>`;
      }
      if (useClearLayout) return "";
      const showQty = fields!.itemQty;
      const showAmt = fields!.itemAmount;
      const colCount = 1 + (showQty ? 1 : 0) + (showAmt ? (showPriceCol ? 2 : 1) : 0);
      return `<tr>
        ${showQty ? `<td class="qty">${line.qty}</td>` : ""}
        <td class="item-name" colspan="${showQty || showAmt ? 1 : colCount}">${escapeHtml(line.label)}</td>
        ${showPriceCol ? `<td class="price">${formatMoney(line.unitPrice, moneyCompact)}</td>` : ""}
        ${showAmt ? `<td class="amt">${formatMoney(lineTotal, moneyCompact)}</td>` : ""}
      </tr>`;
    })
    .join("");

  const totalsRows = isReceipt && fields
    ? [
        fields.subtotal
          ? `<div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(input.subtotal, moneyCompact)}</span></div>`
          : "",
        fields.discount && input.discount > 0
          ? `<div class="row"><span class="label">Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}</span><span class="value discount">− ${formatMoney(input.discount, moneyCompact)}</span></div>`
          : "",
        fields.service
          ? `<div class="row"><span class="label">Service (${input.servicePct}%)</span><span class="value">${formatMoney(input.service, moneyCompact)}</span></div>`
          : "",
        fields.tax
          ? `<div class="row"><span class="label">Tax (${input.taxPct ?? 15}%)</span><span class="value">${formatMoney(input.tax, moneyCompact)}</span></div>`
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

  const metaRows = isReceipt && fields
    ? [
        fields.orderRef ? `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>` : null,
        fields.orderType ? `<span class="meta-chip meta-primary">${escapeHtml(input.modeLabel)}</span>` : null,
        fields.tableLabel && input.tableLabel
          ? `<span class="meta-chip meta-primary">${escapeHtml(input.tableLabel)}</span>`
          : null,
        fields.billRef && input.billRef
          ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef)}</span>`
          : null,
        fields.waiterName && input.waiterName
          ? `<span class="meta-chip">Waiter: ${escapeHtml(input.waiterName)}</span>`
          : null,
        fields.printerName && input.printerName
          ? `<span class="meta-chip">Printer: ${escapeHtml(input.printerName)}</span>`
          : null,
      ]
        .filter(Boolean)
        .join("")
    : [
        `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>`,
        `<span class="meta-chip meta-primary">${escapeHtml(input.modeLabel)}</span>`,
        input.tableLabel
          ? `<span class="meta-chip meta-primary">${escapeHtml(input.tableLabel)}</span>`
          : null,
        input.billRef ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef)}</span>` : null,
        input.waiterName ? `<span class="meta-chip">Waiter: ${escapeHtml(input.waiterName)}</span>` : null,
        input.printerName ? `<span class="meta-chip">Printer: ${escapeHtml(input.printerName)}</span>` : null,
        isOrderUpdate ? `<span class="meta-chip meta-update">UPDATE</span>` : null,
      ]
        .filter(Boolean)
        .join("");

  const kotUpdateBanner = isOrderUpdate
    ? `<div class="kot-update-banner">*** UPDATE — REVISED ORDER ***</div>`
    : "";

  const kotTotalsBlock =
    !isReceipt && kotSettings.showItemTotals
      ? `<div class="kot-totals">
          <div class="row"><span class="label">Total items</span><span class="value">${totalItems}</span></div>
          <div class="row"><span class="label">Total quantity</span><span class="value">${totalQty}</span></div>
        </div>`
      : "";

  const emphasizeMeta = isReceipt || kotSettings.emphasizeOrderMeta;
  const bodyFontSize = !isReceipt ? kotSettings.baseFontSize : receiptFonts.body;
  const kotItemFont = kotSettings.baseFontSize + 3;
  const kotQtyFont = kotSettings.baseFontSize + 4;
  const kotMetaFont = emphasizeMeta ? kotSettings.baseFontSize + 2 : kotSettings.baseFontSize;
  const kotBranchFont = kotSettings.baseFontSize + 5;
  const compact = isReceipt && billSettings.layout === "compact";
  const headerAlign = isReceipt && billSettings.headerAlign === "left" ? "left" : "center";
  const showItemTable = !isReceipt || (!useClearLayout && (fields!.itemQty || fields!.itemAmount || input.lines.length > 0));
  const showClearItems = Boolean(clearItemBlocks);
  const showQtyCol = !isReceipt || fields!.itemQty;
  // Price/Amount are receipt-only — kitchen tickets never show pricing to kitchen staff.
  const showAmtCol = isReceipt && fields!.itemAmount;
  const showItemHeaders = !isReceipt || fields!.itemHeaders;
  const displayBusinessName =
    isReceipt && billSettings.headerBusinessName.trim()
      ? billSettings.headerBusinessName.trim()
      : input.branchName;
  const showHeaderSubtitle =
    isReceipt && fields!.headerSubtitle && billSettings.headerSubtitle.trim().length > 0;
  const showFooterPrimary = isReceipt && fields!.footer;
  const showFooterSecondary =
    isReceipt && fields!.footerSecondary && billSettings.footerSecondaryText.trim().length > 0;
  const showHeaderBlock =
    isReceipt && fields && (fields.branchName || fields.documentTitle || showHeaderSubtitle);

  const itemsHtml = showClearItems
    ? `<div class="clear-items">${clearItemBlocks}</div>`
    : showItemTable
      ? `<table class="items${showAmtCol ? " has-amounts" : ""}">
    ${showItemHeaders
      ? `<thead>
      <tr>
        ${showQtyCol ? '<th class="qty">QTY</th>' : ""}
        <th class="item">ITEM</th>
        ${showPriceCol ? '<th class="price">PRICE</th>' : ""}
        ${showAmtCol ? `<th class="amt">${narrowPaper ? "AMT" : "AMOUNT"}</th>` : ""}
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
              return fields.branchName
                ? `<div class="branch-name" style="text-align:${headerAlign};${blockStyleInline(billSettings, "branchName", receiptFonts.branchName)}">${escapeHtml(displayBusinessName)}</div>`
                : "";
            case "headerSubtitle":
              return showHeaderSubtitle
                ? `<div class="header-subtitle" style="text-align:${headerAlign};${blockStyleInline(billSettings, "headerSubtitle", receiptFonts.headerSubtitle)}">${escapeHtml(billSettings.headerSubtitle.trim())}</div>`
                : "";
            case "documentTitle":
              return fields.documentTitle
                ? `<div class="doc-type" style="text-align:${headerAlign};${blockStyleInline(billSettings, "documentTitle", receiptFonts.docType)}">${escapeHtml(title)}</div>`
                : "";
            case "meta":
              return metaRows ? `<div class="meta">${metaRows}</div>` : "";
            case "notes":
              return fields.notes && input.notes
                ? `<p class="notes" style="${blockStyleInline(billSettings, "notes", receiptFonts.notes)}">${escapeHtml(input.notes)}</p>`
                : "";
            case "timestamp":
              return fields.timestamp || fields.branchCode
                ? `<div class="timestamp" style="text-align:${headerAlign};${blockStyleInline(billSettings, "timestamp", receiptFonts.timestamp)}">${[
                    fields.branchCode ? escapeHtml(input.branchCode) : "",
                    fields.timestamp ? escapeHtml(printedAt) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}</div>`
                : "";
            case "items":
              return itemsHtml;
            case "totals":
              return totalsBlock;
            case "footer":
              return showFooterPrimary
                ? `<div class="footer" style="text-align:${headerAlign};${blockStyleInline(billSettings, "footer", receiptFonts.footer)}">${escapeHtml(billSettings.footerText)}</div>`
                : "";
            case "footerSecondary":
              return showFooterSecondary
                ? `<div class="footer-secondary" style="text-align:${headerAlign};${blockStyleInline(billSettings, "footerSecondary", receiptFonts.footerSecondary)}">${escapeHtml(billSettings.footerSecondaryText.trim())}</div>`
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
    body { padding: ${compact ? "8px 10px 12px" : "16px 14px 20px"}; line-height: ${compact ? "1.35" : "1.5"}; }
    .header { text-align: ${headerAlign}; padding-bottom: ${compact ? "8px" : "12px"}; margin-bottom: ${compact ? "8px" : "12px"}; }
    .meta { justify-content: ${headerAlign === "left" ? "flex-start" : "center"}; margin: ${compact ? "8px 0 10px" : "12px 0 14px"}; }
    .notes, .timestamp { text-align: ${headerAlign}; }
    tbody td { padding: ${compact ? "3px 0" : "5px 0"}; }
    .branch-name { font-size: ${receiptFonts.branchName}px; }
    .doc-type { font-size: ${receiptFonts.docType}px; }
    .meta-chip { font-size: ${receiptFonts.metaChip}px; }
    .meta-chip.bill-ref { font-size: ${receiptFonts.metaChipBillRef}px; }
    .notes { font-size: ${receiptFonts.notes}px; }
    .timestamp { font-size: ${receiptFonts.timestamp}px; }
    thead th { font-size: ${receiptFonts.th}px; }
    td.item-name { font-size: ${receiptFonts.itemName}px; }
    td.qty { font-size: ${receiptFonts.qty}px; }
    td.price { font-size: ${receiptFonts.amt}px; }
    td.amt { font-size: ${receiptFonts.amt}px; }
    .row .label { font-size: ${receiptFonts.rowLabel}px; }
    .row .value { font-size: ${receiptFonts.rowValue}px; }
    .row.grand .label { font-size: ${receiptFonts.grandLabel}px; }
    .row.grand .value { font-size: ${receiptFonts.grandValue}px; }
    .footer { font-size: ${receiptFonts.footer}px; }
    .header-subtitle { font-size: ${receiptFonts.headerSubtitle}px; }
    .footer-secondary { font-size: ${receiptFonts.footerSecondary}px; }
    .custom-line {
      margin: 3px 0;
      font-size: ${receiptFonts.notes}px;
      font-weight: 400;
      color: #374151;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .custom-line-bold {
      font-weight: 600;
      color: #111827;
    }
    .clear-items { margin: 4px 0 8px; }
    .clear-item { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px dashed #d1d5db; }
    .clear-item:last-child { border-bottom: none; margin-bottom: 2px; }
    .clear-item-name {
      font-size: ${receiptFonts.itemName}px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
      line-height: 1.35;
      text-align: left;
    }
    .clear-item-unit {
      margin-top: 2px;
      font-size: ${receiptFonts.amt}px;
      color: #6b7280;
      text-align: right;
    }
    .clear-item-amt {
      margin-top: 2px;
      font-size: ${Math.max(receiptFonts.amt, 11)}px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #111827;
      text-align: right;
    }
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(input.orderRef)}${input.printerName ? ` · ${escapeHtml(input.printerName)}` : ""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: ${bodyFontSize}px;
      font-weight: 400;
      line-height: 1.5;
      color: #111827;
      background: #fff;
      margin: 0 auto;
      padding: ${narrowPaper ? "6px 2px 10px" : "10px 4px 14px"};
      width: ${contentWidthMm}mm;
      max-width: ${contentWidthMm}mm;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 1.5px solid #111827;
      margin-bottom: 12px;
    }
    .branch-name {
      font-size: ${isReceipt ? receiptFonts.branchName : kotBranchFont}px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: #111827;
    }
    .doc-type {
      margin-top: 6px;
      font-size: ${isReceipt ? receiptFonts.docType : kotSettings.baseFontSize}px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #4b5563;
    }
    .header-subtitle {
      margin-top: 4px;
      font-size: ${receiptFonts.headerSubtitle}px;
      font-weight: 500;
      color: #6b7280;
      line-height: 1.35;
    }
    .meta {
      margin: 12px 0 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      justify-content: center;
    }
    .meta-chip {
      display: inline-block;
      max-width: 100%;
      font-size: ${isReceipt ? receiptFonts.metaChip : kotSettings.baseFontSize}px;
      font-weight: 500;
      color: #374151;
      background: #f3f4f6;
      border-radius: 4px;
      padding: 3px 7px;
      line-height: 1.4;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .meta-chip.bill-ref {
      font-weight: 600;
      color: #111827;
      background: #e5e7eb;
    }
    .meta-chip.meta-primary {
      font-size: ${isReceipt ? (emphasizeMeta ? receiptFonts.metaChip + 2 : receiptFonts.metaChip) : kotMetaFont}px;
      font-weight: ${emphasizeMeta ? "700" : "500"};
      color: #111827;
      background: ${emphasizeMeta ? "#fde68a" : "#f3f4f6"};
    }
    .notes {
      margin: -6px 0 12px;
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.notes : kotSettings.baseFontSize}px;
      font-style: italic;
      color: #6b7280;
    }
    .timestamp {
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.timestamp : Math.max(11, kotSettings.baseFontSize - 1)}px;
      font-weight: 500;
      color: #9ca3af;
      margin-bottom: 14px;
      letter-spacing: 0.02em;
    }
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px;
      table-layout: fixed;
    }
    thead th {
      font-size: ${isReceipt ? receiptFonts.th : Math.max(11, kotSettings.baseFontSize - 1)}px;
      font-weight: 700;
      letter-spacing: ${isReceipt ? "0.02em" : "0.04em"};
      text-transform: uppercase;
      color: #6b7280;
      padding: 0 0 6px;
      border-bottom: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.qty {
      width: ${narrowPaper ? "16%" : "12%"};
      text-align: left;
      padding-left: 0;
      padding-right: ${narrowPaper ? "10px" : "8px"};
      white-space: nowrap;
    }
    thead th.item { text-align: left; width: auto; padding-left: ${narrowPaper ? "4px" : "6px"}; }
    thead th.price { width: ${showPriceCol ? "18%" : "0"}; text-align: right; padding-left: 4px; white-space: nowrap; }
    thead th.amt {
      width: ${narrowPaper ? "24%" : "22%"};
      text-align: right;
      padding-left: 6px;
      white-space: nowrap;
    }
    tbody td {
      padding: 5px 0;
      vertical-align: top;
      border-bottom: 1px solid #f3f4f6;
    }
    tbody tr:last-child td { border-bottom: none; }
    /* KOT: header on top → middle space → items last → totals */
    body.ticket-kot .timestamp { margin-bottom: 0; }
    body.ticket-kot .kot-mid-space {
      height: 16px;
      margin: 0;
    }
    body.ticket-kot table.items {
      margin: 0 0 0;
      width: 100%;
      table-layout: fixed;
    }
    body.ticket-kot thead th { padding: 0 0 4px; }
    body.ticket-kot thead th.qty,
    body.ticket-kot td.qty {
      width: 22%;
      text-align: left;
      padding-right: 20px; /* clear gap between Qty and Item */
      vertical-align: middle;
      white-space: nowrap;
    }
    body.ticket-kot thead th.item,
    body.ticket-kot td.item-name {
      text-align: right; /* Item sits on the right, like Total items / Total quantity values */
      width: 78%;
      padding-left: 12px;
    }
    body.ticket-kot tbody td {
      padding: 3px 0;
      border-bottom: none;
      line-height: 1.3;
      vertical-align: middle;
    }
    body.ticket-kot tbody tr.kot-item-sep td {
      border-bottom: 1px solid #d1d5db;
      padding: 4px 0;
    }
    /* Last item: no extra line — middle space before totals instead */
    body.ticket-kot tbody tr.kot-item-sep:last-child td {
      border-bottom: none;
      padding-bottom: 2px;
    }
    body.ticket-kot .kot-totals {
      margin: 14px 0 4px;
      padding-top: 10px;
      border-top: 1px dashed #9ca3af;
    }
    body.ticket-kot .footer { margin-top: 10px; padding-top: 8px; }
    body.ticket-kot .kot-banner { margin-top: 4px; padding: 4px 6px; }
    td.item-name {
      font-size: ${isReceipt ? (narrowPaper ? Math.max(11, receiptFonts.itemName - 1) : receiptFonts.itemName) : kotItemFont}px;
      font-weight: ${isReceipt ? "500" : "700"};
      color: #111827;
      text-align: ${isReceipt ? "left" : "right"};
      padding-left: ${isReceipt ? (narrowPaper ? "4px" : "6px") : "12px"};
      padding-right: ${isReceipt ? "4px" : "0"};
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.3;
      vertical-align: top;
    }
    td.qty {
      width: ${narrowPaper ? "16%" : "12%"};
      text-align: left !important;
      font-size: ${isReceipt ? receiptFonts.qty : kotQtyFont}px;
      font-weight: 700;
      color: #111827;
      font-variant-numeric: tabular-nums;
      padding-left: 0;
      padding-right: ${narrowPaper ? "10px" : "8px"};
      white-space: nowrap;
      vertical-align: top;
    }
    /* Customer receipt: clear QTY | ITEM | AMT columns (never merge headers). */
    body.ticket-receipt table.items {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
    }
    body.ticket-receipt table.items.has-amounts thead th.item,
    body.ticket-receipt table.items.has-amounts td.item-name {
      text-align: left;
      padding-left: ${narrowPaper ? "4px" : "6px"};
      padding-right: 4px;
    }
    body.ticket-receipt table.items.has-amounts td.qty,
    body.ticket-receipt table.items.has-amounts thead th.qty {
      width: ${narrowPaper ? "16%" : "12%"};
      text-align: left !important;
      padding-left: 0;
      padding-right: ${narrowPaper ? "10px" : "8px"};
      white-space: nowrap;
      vertical-align: top;
    }
    body.ticket-receipt table.items.has-amounts thead th.amt,
    body.ticket-receipt table.items.has-amounts td.amt {
      width: ${narrowPaper ? "24%" : "22%"};
      vertical-align: top;
    }
    td.price {
      text-align: right;
      white-space: nowrap;
      font-size: ${receiptFonts.amt}px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #6b7280;
      padding-right: 2px;
      width: ${showPriceCol ? "18%" : "0"};
      vertical-align: top;
    }
    td.amt {
      text-align: right;
      white-space: nowrap;
      font-size: ${receiptFonts.amt}px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      width: ${narrowPaper ? "24%" : "22%"};
      padding-left: 6px;
      padding-right: 0;
      overflow: visible;
      color: #111827;
      vertical-align: top;
    }
    .totals {
      border-top: 1.5px solid #111827;
      padding-top: 8px;
      margin-top: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 3px 0;
      gap: 6px;
      max-width: 100%;
    }
    .row .label {
      font-size: ${isReceipt ? receiptFonts.rowLabel : kotSettings.baseFontSize}px;
      font-weight: 500;
      color: #4b5563;
      min-width: 0;
      flex: 1 1 auto;
      overflow: visible;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.35;
    }
    .row .value {
      font-size: ${isReceipt ? receiptFonts.rowValue : kotSettings.baseFontSize + 1}px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #111827;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      flex: 0 1 auto;
      max-width: 58%;
      text-align: right;
      line-height: 1.35;
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
      color: #111827;
      letter-spacing: -0.01em;
    }
    .row.grand .value {
      font-size: ${receiptFonts.grandValue}px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${isReceipt ? receiptFonts.footer : kotSettings.baseFontSize}px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #374151;
    }
    .footer-secondary {
      margin-top: 6px;
      font-size: ${receiptFonts.footerSecondary}px;
      font-weight: 400;
      letter-spacing: 0.02em;
      text-transform: none;
      color: #6b7280;
      line-height: 1.4;
    }
    .kot-banner {
      margin-top: 8px;
      text-align: center;
      font-size: ${kotSettings.baseFontSize}px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #111827;
      border: 2px solid #111827;
      padding: 8px 10px;
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
      font-size: ${kotSettings.baseFontSize + 2}px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #111827;
      border: 2px solid #111827;
      padding: 7px 8px;
    }
    .kot-totals {
      border-top: 1px dashed #9ca3af;
      padding-top: 8px;
      margin: 8px 0 4px;
    }
    @media print {
      body {
        padding: 0 1px;
        width: ${contentWidthMm}mm;
        max-width: ${contentWidthMm}mm;
        overflow-x: hidden;
      }
      .meta-chip { background: transparent; padding: 0; }
      @page {
        margin: ${Math.max(1, marginMm)}mm;
        size: ${paperSize === "58mm" ? "58mm" : paperSize === "A4" ? "A4" : "80mm"} auto;
      }
    }
    ${receiptCss}
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
    <div class="branch-name">${escapeHtml(input.branchName)}</div>
    <div class="doc-type">${escapeHtml(title)}</div>
  </header>`}
  ${metaRows ? `<div class="meta">${metaRows}</div>` : ""}
  ${kotUpdateBanner}
  ${input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : ""}
  <div class="timestamp">${escapeHtml(input.branchCode)} · ${escapeHtml(printedAt)}</div>
  <div class="kot-mid-space" aria-hidden="true"></div>
  ${showItemTable
    ? `<table class="items">
    <thead>
      <tr>
        <th class="qty">QTY</th>
        <th class="item">ITEM</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>`
    : ""}
  ${kotTotalsBlock}
  <div class="footer"><div class="kot-banner${isOrderUpdate ? " kot-banner-update" : ""}">${
    isOrderUpdate ? "Kitchen copy — UPDATE" : "Kitchen copy — order"
  }</div></div>`
  }
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
  const systemPrinterName = options?.systemPrinterName?.trim();
  const requireNamed = options?.requireNamedPrinter ?? Boolean(systemPrinterName);

  if (systemPrinterName) {
    const plain = htmlToPlainText(html);
    if (!plain) {
      return { ok: false, usedNamedPrinter: false, error: "Print content was empty after conversion." };
    }
    const result = await printToSystemPrinter({
      printerName: systemPrinterName,
      content: plain + "\n\n",
      jobName: jobTitle,
      copies,
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
  if (input.lines.length === 0) return false;

  const html = buildTicketHtml(input);
  const docTitle = input.printerName
    ? `${input.kind === "receipt" ? "Receipt" : "KOT"} · ${input.printerName}`
    : undefined;
  return printHtmlDocument(html, docTitle);
}

/** Print a ticket, routing to the assigned OS printer when `systemPrinterName` is set. */
export async function printTicketAsync(input: PrintTicketInput): Promise<boolean> {
  const result = await printTicketDetailed(input);
  return result.ok;
}

/** Print a ticket and report whether the named OS printer was used. */
export async function printTicketDetailed(input: PrintTicketInput): Promise<PrintJobResult> {
  if (input.lines.length === 0) {
    return { ok: false, usedNamedPrinter: false, error: "No lines to print." };
  }

  const html = buildTicketHtml(input);
  const docTitle = input.printerName
    ? `${input.kind === "receipt" ? "Receipt" : "KOT"} · ${input.printerName}`
    : input.kind === "receipt"
      ? "Receipt"
      : "KOT";
  const systemPrinterName = input.systemPrinterName?.trim();
  const copies = Math.max(1, input.copies ?? 1);

  // Named OS printers receive fixed-width thermal text (avoids right-edge cutoff).
  if (systemPrinterName) {
    const thermal = input.branchCode
      ? loadThermalPrintSettings(input.branchCode)
      : DEFAULT_THERMAL_PRINT_SETTINGS;
    const plain = buildThermalPlainText(input, thermal);
    if (!plain.trim()) {
      return { ok: false, usedNamedPrinter: false, error: "Print content was empty after conversion." };
    }
    const result = await printToSystemPrinter({
      printerName: systemPrinterName,
      content: `${plain}\n\n`,
      jobName: docTitle,
      copies,
    });
    if (result.ok) return { ok: true, usedNamedPrinter: true };
    return { ok: false, usedNamedPrinter: false, error: result.error };
  }

  // OS print dialog already has its own Copies control — open it once only.
  const opened = await printHtmlDocumentAndWait(html, docTitle);
  if (!opened) {
    return { ok: false, usedNamedPrinter: false, error: "Could not open the print dialog." };
  }
  return { ok: true, usedNamedPrinter: false };
}

/** Test page — targets the named OS printer when available. */
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
  },
): Promise<boolean> {
  const thermal =
    options?.thermal ??
    (options?.branchCode
      ? loadThermalPrintSettings(options.branchCode)
      : DEFAULT_THERMAL_PRINT_SETTINGS);
  const paper = options?.paperSize ?? thermal.defaultPaperSize;
  const width = thermalCharsPerLine(paper, thermal);
  const line = "-".repeat(width);
  const stamped = new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  const plain = [
    centerLine("TEST PRINT", width),
    line,
    `Printer: ${printerName}`.slice(0, width),
    `Paper: ${paper}`.slice(0, width),
    stamped.slice(0, width),
    line,
    ...wrapWords("If this printed correctly, the printer is connected and working.", width),
    line,
    centerLine("1234567890".repeat(Math.ceil(width / 10)).slice(0, width), width),
    "",
    "",
  ].join("\n");

  const contentWidthMm = thermalContentWidthMm(paper, thermal.marginMm);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Test print · ${escapeHtml(printerName)}</title>
<style>
  body {
    font-family: ui-monospace, Consolas, monospace;
    width: ${contentWidthMm}mm;
    max-width: ${contentWidthMm}mm;
    margin: 0 auto;
    padding: 8px 0;
    text-align: center;
    font-size: 11px;
  }
  h1 { font-size: 14px; margin: 0 0 8px; }
  p { font-size: 11px; margin: 4px 0; word-break: break-word; }
  hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
  @page { margin: ${thermal.marginMm}mm; size: ${paper === "58mm" ? "58mm" : paper === "A4" ? "A4" : "80mm"} auto; }
</style>
</head>
<body>
  <h1>TEST PRINT</h1>
  <hr />
  <p>Printer: ${escapeHtml(printerName)}</p>
  <p>Paper: ${escapeHtml(paper)}</p>
  <p>${escapeHtml(stamped)}</p>
  <hr />
  <p>If this printed correctly, the printer is connected and working.</p>
  <hr />
  <p>${escapeHtml("1234567890".repeat(Math.ceil(width / 10)).slice(0, width))}</p>
</body>
</html>`;

  const copies = Math.max(1, options?.copies ?? 1);
  const named = await printToSystemPrinter({
    printerName,
    content: `${plain}\n\n`,
    jobName: `Test print · ${printerName}`,
    copies,
  });
  if (named.ok) return true;
  return printHtmlDocumentAsync(html, {
    copies,
    jobTitle: `Test print · ${printerName}`,
    requireNamedPrinter: false,
  });
}

export function billToPrintInput(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: bill.orderRef ?? bill.billRef,
    billRef: bill.billRef,
    modeLabel: billChannelLabel(bill.tableLabel),
    tableLabel: bill.tableLabel,
    waiterName: bill.waiterName,
    notes: bill.notes ?? undefined,
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
  const systemPrinterName = options?.systemPrinterName?.trim() || undefined;
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
): Omit<PrintTicketInput, "kind"> {
  const lines = parseItemsSummary(ticket.itemsSummary).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice ?? 0,
  }));

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: billChannelLabel(ticket.stationLabel),
    tableLabel: ticket.stationLabel,
    lines: lines.length > 0 ? lines : [{ label: ticket.itemsSummary || "Items", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
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
  const totals = computeTicketTotals(
    subtotal,
    0,
    settings.servicePct,
    settings.taxPct,
    deliveryCharge,
  );

  return {
    branchName,
    branchCode,
    orderRef: order.ref,
    modeLabel: order.orderMode,
    tableLabel: order.stationLabel,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    service: totals.service,
    tax: totals.tax,
    deliveryCharge: totals.deliveryCharge > 0 ? totals.deliveryCharge : undefined,
    total: totals.total,
    servicePct: settings.servicePct,
    taxPct: settings.taxPct,
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

/** Latest-orders Print/Close: always the customer receipt (not kitchen KOT). */
export async function printPosRecentOrderAsync(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string; systemPrinterName?: string },
): Promise<boolean> {
  const systemPrinterName = options?.systemPrinterName?.trim() || undefined;
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
