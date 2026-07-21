import type { Bill, KitchenTicket } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { parseItemsSummary, type PosRecentOrder } from "./recentOrders";
import {
  billReceiptFontSizes,
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  type KotPrintSettings,
} from "./kotPrintSettings";
import type { PrinterPaperSize, PrinterProfile } from "./printerRouting";
import { isVirtualSystemPrinter, printToSystemPrinter } from "./systemPrinters";

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

function formatMoney(pkr: number): string {
  return `Rs ${pkr.toLocaleString("en-PK")}`;
}

export function buildTicketHtml(input: PrintTicketInput): string {
  const isReceipt = input.kind === "receipt";
  const kotSettings =
    input.kotSettings ??
    (input.branchCode ? loadKotPrintSettings(input.branchCode) : DEFAULT_KOT_PRINT_SETTINGS);
  const billSettings =
    input.billPrintSettings ??
    (input.branchCode ? loadBillPrintSettings(input.branchCode) : DEFAULT_BILL_PRINT_SETTINGS);
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

  const lineRows = input.lines
    .map((line) => {
      const lineTotal = line.unitPrice * line.qty;
      const kotSepClass = !isReceipt && kotSettings.itemUnderlineSeparator ? ' class="kot-item-sep"' : "";
      if (!isReceipt) {
        // Match header order: Qty | Item (including last row underline when enabled)
        return `<tr${kotSepClass}>
        <td class="qty">${line.qty}</td>
        <td class="item-name">${escapeHtml(line.label)}</td>
      </tr>`;
      }
      const showQty = fields!.itemQty;
      const showAmt = fields!.itemAmount;
      const colCount = 1 + (showQty ? 1 : 0) + (showAmt ? 2 : 0);
      return `<tr>
        ${showQty ? `<td class="qty">${line.qty}</td>` : ""}
        <td class="item-name" colspan="${showQty || showAmt ? 1 : colCount}">${escapeHtml(line.label)}</td>
        ${showAmt ? `<td class="price">${formatMoney(line.unitPrice)}</td>` : ""}
        ${showAmt ? `<td class="amt">${formatMoney(lineTotal)}</td>` : ""}
      </tr>`;
    })
    .join("");

  const totalsRows = isReceipt && fields
    ? [
        fields.subtotal
          ? `<div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(input.subtotal)}</span></div>`
          : "",
        fields.discount && input.discount > 0
          ? `<div class="row"><span class="label">Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}</span><span class="value discount">− ${formatMoney(input.discount)}</span></div>`
          : "",
        fields.service
          ? `<div class="row"><span class="label">Service charge (${input.servicePct}%)</span><span class="value">${formatMoney(input.service)}</span></div>`
          : "",
        fields.tax
          ? `<div class="row"><span class="label">Tax (${input.taxPct ?? 15}%)</span><span class="value">${formatMoney(input.tax)}</span></div>`
          : "",
        fields.delivery && (input.deliveryCharge ?? 0) > 0
          ? `<div class="row"><span class="label">Delivery</span><span class="value">${formatMoney(input.deliveryCharge!)}</span></div>`
          : "",
        fields.total
          ? `<div class="row grand"><span class="label">Total</span><span class="value">${formatMoney(input.total)}</span></div>`
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

  const bodyFontSize = !isReceipt ? kotSettings.baseFontSize : receiptFonts.body;
  // Order ref / type / table chips are always emphasized (bold, larger) on customer receipts;
  // on kitchen tickets it stays behind the existing toggle.
  const emphasizeMeta = isReceipt || kotSettings.emphasizeOrderMeta;
  const compact = isReceipt && billSettings.layout === "compact";
  const headerAlign = isReceipt && billSettings.headerAlign === "left" ? "left" : "center";
  const showItemTable = !isReceipt || fields!.itemQty || fields!.itemAmount || input.lines.length > 0;
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
      padding: 16px 14px 20px;
      max-width: 80mm;
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
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: #111827;
    }
    .doc-type {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #4b5563;
    }
    .header-subtitle {
      margin-top: 4px;
      font-size: 8.5px;
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
      font-size: 9.5px;
      font-weight: 500;
      color: #374151;
      background: #f3f4f6;
      border-radius: 4px;
      padding: 2px 6px;
      line-height: 1.4;
    }
    .meta-chip.bill-ref {
      font-weight: 600;
      color: #111827;
      background: #e5e7eb;
    }
    .meta-chip.meta-primary {
      font-size: ${emphasizeMeta ? "12px" : "9.5px"};
      font-weight: ${emphasizeMeta ? "700" : "500"};
      color: #111827;
      background: ${emphasizeMeta ? "#fde68a" : "#f3f4f6"};
    }
    .notes {
      margin: -6px 0 12px;
      text-align: center;
      font-size: 9.5px;
      font-style: italic;
      color: #6b7280;
    }
    .timestamp {
      text-align: center;
      font-size: 9px;
      font-weight: 500;
      color: #9ca3af;
      margin-bottom: 14px;
      letter-spacing: 0.02em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px;
      table-layout: fixed;
    }
    thead th {
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
      padding: 0 0 6px;
      border-bottom: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.qty { width: 18%; text-align: left; padding-right: 12px; }
    thead th.item { text-align: right; }
    thead th.price { text-align: right; }
    thead th.amt { text-align: right; }
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
      font-size: 10.5px;
      font-weight: 500;
      color: #111827;
      text-align: right;
      padding-left: 12px;
      padding-right: 0;
      word-break: break-word;
    }
    td.qty {
      width: 18%;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #374151;
      font-variant-numeric: tabular-nums;
      padding-right: 20px;
      white-space: nowrap;
      vertical-align: middle;
    }
    /* Customer receipt with price columns: keep Item left of Price, but still gap after Qty */
    body.ticket-receipt table.items.has-amounts thead th.item,
    body.ticket-receipt table.items.has-amounts td.item-name {
      text-align: left;
      padding-left: 8px;
    }
    body.ticket-receipt table.items.has-amounts td.qty,
    body.ticket-receipt table.items.has-amounts thead th.qty {
      width: 36px;
      padding-right: 14px;
    }
    td.price {
      text-align: right;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #6b7280;
      padding-right: 8px;
    }
    td.amt {
      text-align: right;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #111827;
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
      gap: 12px;
    }
    .row .label {
      font-size: 9.5px;
      font-weight: 500;
      color: #4b5563;
    }
    .row .value {
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #111827;
      white-space: nowrap;
    }
    .row .value.discount { color: #dc2626; }
    .row.grand {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
    }
    .row.grand .label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }
    .row.grand .value {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #9ca3af;
    }
    .footer-secondary {
      margin-top: 6px;
      font-size: 8px;
      font-weight: 400;
      letter-spacing: 0.02em;
      text-transform: none;
      color: #6b7280;
      line-height: 1.4;
    }
    .kot-banner {
      margin-top: 8px;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #111827;
      border: 1.5px solid #111827;
      padding: 6px 8px;
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
      font-size: 12px;
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
      body { padding: 0; }
      .meta-chip { background: transparent; padding: 0; }
      @page { margin: 4mm; size: ${input.paperSize === "58mm" ? "58mm" : input.paperSize === "A4" ? "A4" : "80mm"} auto; }
    }
    ${receiptCss}
  </style>
</head>
<body class="${isReceipt ? "ticket-receipt" : "ticket-kot"}">
  ${showHeaderBlock
    ? `<header class="header">
    ${fields!.branchName ? `<div class="branch-name">${escapeHtml(displayBusinessName)}</div>` : ""}
    ${showHeaderSubtitle ? `<div class="header-subtitle">${escapeHtml(billSettings.headerSubtitle.trim())}</div>` : ""}
    ${fields!.documentTitle ? `<div class="doc-type">${escapeHtml(title)}</div>` : ""}
  </header>`
    : !isReceipt
      ? `<header class="header">
    <div class="branch-name">${escapeHtml(input.branchName)}</div>
    <div class="doc-type">${escapeHtml(title)}</div>
  </header>`
      : ""}
  ${metaRows ? `<div class="meta">${metaRows}</div>` : ""}
  ${kotUpdateBanner}
  ${isReceipt && fields?.notes && input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : !isReceipt && input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : ""}
  ${isReceipt && fields && (fields.timestamp || fields.branchCode)
    ? `<div class="timestamp">${[
        fields.branchCode ? escapeHtml(input.branchCode) : "",
        fields.timestamp ? escapeHtml(printedAt) : "",
      ]
        .filter(Boolean)
        .join(" · ")}</div>`
    : !isReceipt
      ? `<div class="timestamp">${escapeHtml(input.branchCode)} · ${escapeHtml(printedAt)}</div>`
      : ""}
  ${!isReceipt ? `<div class="kot-mid-space" aria-hidden="true"></div>` : ""}
  ${showItemTable
    ? `<table class="items${showAmtCol ? " has-amounts" : ""}">
    ${showItemHeaders
      ? `<thead>
      <tr>
        ${showQtyCol ? '<th class="qty">Qty</th>' : ""}
        <th class="item">Item</th>
        ${showAmtCol ? '<th class="price">Price</th>' : ""}
        ${showAmtCol ? '<th class="amt">Amount</th>' : ""}
      </tr>
    </thead>`
      : ""}
    <tbody>${lineRows}</tbody>
  </table>`
    : ""}
  ${kotTotalsBlock}
  ${totalsBlock}
  ${showFooterPrimary || showFooterSecondary
    ? `<div class="footer">
    ${showFooterPrimary ? escapeHtml(billSettings.footerText) : ""}
    ${showFooterSecondary ? `<div class="footer-secondary">${escapeHtml(billSettings.footerSecondaryText.trim())}</div>` : ""}
  </div>`
    : !isReceipt
      ? `<div class="footer"><div class="kot-banner${isOrderUpdate ? " kot-banner-update" : ""}">${
          isOrderUpdate ? "Kitchen copy — UPDATE" : "Kitchen copy — order"
        }</div></div>`
      : ""}
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

/** Opens the system print dialog with an arbitrary HTML document via a hidden iframe. */
export function printHtmlDocument(html: string, docTitle?: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  if (docTitle) {
    doc.title = docTitle;
  }

  const cleanup = (): void => {
    setTimeout(() => iframe.remove(), 500);
  };

  win.onafterprint = cleanup;

  // Give layout a tick before print (WebKit / Tauri webview).
  requestAnimationFrame(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 30_000);
  });

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

  for (let i = 0; i < copies; i++) {
    if (!printHtmlDocument(html, jobTitle)) {
      return { ok: false, usedNamedPrinter: false, error: "Could not open the print dialog." };
    }
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
  // When an OS printer is assigned, require it — do not silently use another device.
  return printHtmlDocumentDetailed(html, {
    systemPrinterName: input.systemPrinterName,
    copies: input.copies,
    jobTitle: docTitle,
    requireNamedPrinter: Boolean(input.systemPrinterName?.trim()),
  });
}

/** Test page — targets the named OS printer when available. */
export function printTestPage(printerName: string): boolean {
  void printTestPageAsync(printerName);
  return true;
}

export async function printTestPageAsync(
  printerName: string,
  options?: { copies?: number },
): Promise<boolean> {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Test print · ${escapeHtml(printerName)}</title>
<style>
  body { font-family: monospace; width: 280px; margin: 0 auto; padding: 16px 0; text-align: center; }
  h1 { font-size: 14px; margin: 0 0 8px; }
  p { font-size: 11px; margin: 4px 0; }
  hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
</style>
</head>
<body>
  <h1>TEST PRINT</h1>
  <hr />
  <p>Printer: ${escapeHtml(printerName)}</p>
  <p>${escapeHtml(new Date().toLocaleString())}</p>
  <hr />
  <p>If this printed correctly, the printer is connected and working.</p>
</body>
</html>`;
  return printHtmlDocumentAsync(html, {
    systemPrinterName: printerName,
    copies: options?.copies ?? 1,
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
  options?: { printerName?: string; systemPrinterName?: string; billPrintSettings?: BillPrintSettings },
): boolean {
  void printBillAsync(branchName, branchCode, bill, options);
  return true;
}

export async function printBillAsync(
  branchName: string,
  branchCode: string,
  bill: Bill,
  options?: { printerName?: string; systemPrinterName?: string; billPrintSettings?: BillPrintSettings },
): Promise<boolean> {
  // Never treat display/profile names as OS spooler names.
  const systemPrinterName = options?.systemPrinterName?.trim() || undefined;
  return printReceiptAsync({
    ...billToPrintInput(branchName, branchCode, bill),
    printerName: options?.printerName ?? systemPrinterName,
    systemPrinterName,
    billPrintSettings: options?.billPrintSettings ?? loadBillPrintSettings(branchCode),
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

export function printPosRecentOrder(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string; systemPrinterName?: string },
): boolean {
  void printPosRecentOrderAsync(branchName, branchCode, order, options);
  return true;
}

export async function printPosRecentOrderAsync(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string; systemPrinterName?: string },
): Promise<boolean> {
  if (order.kind === "paid" && order.bill) {
    return printBillAsync(branchName, branchCode, order.bill, {
      printerName: options?.printerName,
      systemPrinterName: options?.systemPrinterName,
    });
  }
  if (order.kitchenTicket) {
    return printKotAsync({
      ...kitchenTicketToKotPrint(order.kitchenTicket, branchName, branchCode),
      printerName: options?.printerName,
      systemPrinterName: options?.systemPrinterName,
    });
  }
  if (order.detail.kind === "pending") {
    return printKotAsync({
      branchName,
      branchCode,
      orderRef: order.detail.orderRef ?? order.detail.ticketRef,
      modeLabel: order.orderMode,
      tableLabel: order.stationLabel,
      lines: order.detail.lines.map((line) => ({
        label: line.label,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0,
      })),
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      servicePct: 0,
      discountPct: 0,
      printerName: options?.printerName,
      systemPrinterName: options?.systemPrinterName,
    });
  }
  return false;
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
